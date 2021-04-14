import {
  DefinitionProvider,
  FileSystemWatcher,
  workspace,
  Uri,
  Position,
  TextDocument,
  Location
} from 'vscode';

import { getTreeForFile, getTreeForText } from './parser';
import { collectFshFilesForPath, getTargetName } from './utils';

export class FshDefinitionProvider implements DefinitionProvider {
  // nameLocations provides a map from a name to all of that name's locations.
  nameLocations: Map<string, Location[]> = new Map();
  // fileNames provides a map from a file path to all of the names in that file
  fileNames: Map<string, string[]> = new Map();
  // fsWatcher keeps an eye on the workspace for filesystem events
  fsWatcher: FileSystemWatcher;

  constructor() {
    if (workspace && workspace.workspaceFolders) {
      this.scanAll();
      this.fsWatcher = workspace.createFileSystemWatcher('**/*.fsh');
      this.fsWatcher.onDidChange(this.updateNamesFromFile, this);
      this.fsWatcher.onDidCreate(this.updateNamesFromFile, this);
      this.fsWatcher.onDidDelete(this.handleDeletedFile, this);
    }
  }

  public scanAll(): void {
    this.nameLocations.clear();
    this.fileNames.clear();
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
    for (const [filepath, doc] of parsedFsh) {
      this.fileNames.set(filepath, []);
      // look for a keyword that starts a definition
      // Alias, CodeSystem, Extension, Instance, Invariant, Mapping, Profile,
      // RuleSet, ValueSet
      if (doc.entity() && doc.entity().length > 0) {
        for (const entity of doc.entity()) {
          const { name, startLine } = getNameAndLine(entity);
          // if we found a name, add it to our maps
          if (name) {
            this.fileNames.get(filepath).push(name);
            if (!this.nameLocations.has(name)) {
              this.nameLocations.set(name, []);
            }
            this.nameLocations
              .get(name)
              .push(new Location(Uri.file(filepath), new Position(startLine, 0)));
          }
        }
      }
    }
  }

  public updateNamesFromFile(filepath: string | Uri, file?: TextDocument): void {
    if (file) {
      filepath = file.uri.fsPath;
    } else if (filepath instanceof Uri) {
      filepath = filepath.fsPath;
    }
    // if this file has already been parsed,
    // clear out its old data from nameLocations.
    if (this.fileNames.has(filepath)) {
      const affectedNames = this.fileNames.get(filepath);
      affectedNames.forEach(name => {
        const oldLocations = this.nameLocations.get(name) ?? [];
        this.nameLocations.set(
          name,
          oldLocations.filter(location => {
            return location.uri.fsPath !== filepath;
          })
        );
        // if a name has no remaining locations, it's gone!
        if (this.nameLocations.get(name).length === 0) {
          this.nameLocations.delete(name);
        }
      });
    }
    // parse this file and add updated data
    const doc = file ? getTreeForText(file.getText()) : getTreeForFile(filepath);
    const newNames: string[] = [];
    if (doc.entity() && doc.entity().length > 0) {
      for (const entity of doc.entity()) {
        const { name, startLine } = getNameAndLine(entity);
        // if we found a name, add it to our maps
        if (name) {
          newNames.push(name);
          if (!this.nameLocations.has(name)) {
            this.nameLocations.set(name, []);
          }
          this.nameLocations
            .get(name)
            .push(new Location(Uri.file(filepath), new Position(startLine, 0)));
        }
      }
    }
    this.fileNames.set(filepath, newNames);
  }

  public handleDeletedFile(filepath: string | Uri): void {
    if (filepath instanceof Uri) {
      filepath = filepath.fsPath;
    }
    // remove any locations pointing to this file
    if (this.fileNames.has(filepath)) {
      const affectedNames = this.fileNames.get(filepath);
      affectedNames.forEach(name => {
        const oldLocations = this.nameLocations.get(name) ?? [];
        const newLocations = oldLocations.filter(location => {
          return location.uri.fsPath !== filepath;
        });
        // if a name has no remaining locations, it's gone!
        if (newLocations.length) {
          this.nameLocations.set(name, newLocations);
        } else {
          this.nameLocations.delete(name);
        }
      });
    }
    // remove this file from the fileNames map
    this.fileNames.delete(filepath);
  }

  public handleDirtyFiles(): void {
    if (!(workspace && workspace.workspaceFolders)) {
      return;
    }
    workspace.textDocuments.forEach(textDocument => {
      if (textDocument.isDirty) {
        this.updateNamesFromFile(textDocument.uri, textDocument);
      }
    });
  }

  public provideDefinition(
    document: TextDocument,
    position: Position
  ): Thenable<Location | Location[]> {
    return new Promise((resolve, reject) => {
      try {
        // Update info for all files that have been modified, but not saved
        this.handleDirtyFiles();
        const name = getTargetName(document, position);
        resolve(this.nameLocations.get(name));
      } catch (e) {
        reject(e);
      }
    });
  }
}

function getNameAndLine(entity: any): { name: string; startLine: number } {
  let name: string;
  let startLine: number;
  // some entities work a little differently
  if (entity.alias()) {
    name = entity.alias().SEQUENCE()[0].getText();
    startLine = entity.alias().start.line - 1;
  } else if (entity.ruleSet()) {
    name = entity.ruleSet().RULESET_REFERENCE().getText().trim();
    startLine = entity.ruleSet().start.line - 1;
  } else if (entity.paramRuleSet()) {
    const rulesetReference = entity.paramRuleSet().PARAM_RULESET_REFERENCE().getText();
    const paramListStart = rulesetReference.indexOf('(');
    name = rulesetReference.slice(0, paramListStart).trim();
    startLine = entity.paramRuleSet().start.line - 1;
  } else {
    const typedEntity =
      entity.profile() ??
      entity.extension() ??
      entity.instance() ??
      entity.valueSet() ??
      entity.codeSystem() ??
      entity.invariant() ??
      entity.mapping();
    name = typedEntity.name().getText();
    startLine = typedEntity.start.line - 1;
  }
  return {
    name,
    startLine
  };
}
