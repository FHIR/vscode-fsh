import {
  languages, ExtensionContext, DocumentFilter, DefinitionProvider, TextDocument, Position, CancellationToken, Location, LocationLink, ProviderResult, workspace, Uri
} from 'vscode';
import fs from 'fs';
import path from 'path';
import { getTreeForFile } from './parser';

const FSH_MODE: DocumentFilter = { language: 'fsh', scheme: 'file' };

export function activate(context: ExtensionContext) {
	context.subscriptions.push(languages.registerDefinitionProvider(FSH_MODE, new FshDefinitionProvider()));
}

class FshDefinitionProvider implements DefinitionProvider {
  public provideDefinition(document: TextDocument, position: Position): Thenable<Location> {
    return new Promise((resolve, reject) => {
      try {
        // what is the name of the thing we want to get a definition of?
        const name = document.getText(document.getWordRangeAtPosition(position));
        const location: Location = getDefinitionLocation(name);
        resolve(location);
      } catch (e) {
        reject(e);
      }
    });
  }
}

function getDefinitionLocation(target: string): Location {
  if (!(workspace && workspace.workspaceFolders)) {
		return;
	}
  // get all our fsh files
  const fshFiles: string[] = [];
  workspace.workspaceFolders.forEach(folder => {
    const folderPath = folder.uri.fsPath;
    collectFshFilesForPath(folderPath, fshFiles);
  });
  const parsedFsh: Map<string, any> = new Map();
  fshFiles.forEach(fshFile => {
    parsedFsh.set(fshFile, getTreeForFile(fshFile));
  });

  for(const [filepath, doc] of parsedFsh) {
    // look for a keyword that starts a definition
    // Alias, CodeSystem, Extension, Instance, Invariant, Mapping, Profile,
    // RuleSet, ValueSet
    if(doc.entity() && doc.entity().length > 0) {
      for(const entity of doc.entity()) {
        // some entities work a little differently
        if(entity.alias()) {
          if(target === entity.alias().SEQUENCE()[0].getText()) {
            return new Location(Uri.file(filepath), new Position(entity.alias().start.line - 1, 0));
          }
        } else if(entity.ruleSet()) {
          if(target === entity.ruleSet().RULESET_REFERENCE().getText()) {
            return new Location(Uri.file(filepath), new Position(entity.ruleSet().start.line - 1, 0));
          }
        } else if(entity.paramRuleSet()) {
          const rulesetReference = entity.paramRuleSet().PARAM_RULESET_REFERENCE().getText();
          const paramListStart = rulesetReference.indexOf('(');
          const name = rulesetReference.slice(0, paramListStart).trim();
          if(target === name) {
            return new Location(Uri.file(filepath), new Position(entity.paramRuleSet().start.line - 1, 0));
          }
        } else {
          let typedEntity = entity.profile() ??
            entity.extension() ??
            entity.instance() ??
            entity.valueSet() ??
            entity.codeSystem() ??
            entity.invariant() ??
            entity.mapping();
            if(target === typedEntity.name().getText()) {
              return new Location(Uri.file(filepath), new Position(typedEntity.start.line - 1, 0));
            }
        }
      }
    }
  }
  return;
}

function collectFshFilesForPath(filepath: string, fshFiles: string[]) {
  const stats = fs.statSync(filepath);
  if(stats.isDirectory()) {
    fs.readdirSync(filepath).forEach(file => {
      collectFshFilesForPath(path.join(filepath, file), fshFiles);
    });
  } else if(filepath.endsWith('.fsh')) {
    fshFiles.push(filepath);
  } 
  return fshFiles;
}