import {
  languages,
  commands,
  window,
  ExtensionContext,
  DocumentFilter,
  DefinitionProvider,
  TextDocument,
  Position,
  Location,
  workspace,
  env,
  Uri
} from 'vscode';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getTreeForFile } from './parser';

const FSH_MODE: DocumentFilter = { language: 'fsh', scheme: 'file' };
// For FSH entity names, show the user FSH documentation.
// Extension has an unusual key pair in order to differentiate between cases
// where it is used as a FSH entity and where it is used as a type.
export const SPECIAL_URLS = new Map<string, Uri>([
  ['alias', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-aliases')],
  [
    'profile',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-profiles', true)
  ],
  ['extension', Uri.parse('https://hl7.org/fhir/extensibility.html', true)],
  ['extension:', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-extensions')],
  [
    'invariant',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-invariants', true)
  ],
  ['instance', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-instances')],
  ['valueset', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-value-sets')],
  [
    'codesystem',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-code-systems')
  ],
  ['ruleset', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-rule-sets')],
  [
    'mapping',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-mappings', true)
  ],
  [
    'logical',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-logical-models', true)
  ],
  ['resource', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-resources')]
]);

class FshDefinitionProvider implements DefinitionProvider {
  public provideDefinition(document: TextDocument, position: Position): Thenable<Location> {
    return new Promise((resolve, reject) => {
      try {
        const name = getTargetName(document, position);
        const location: Location = getDefinitionLocation(name);
        resolve(location);
      } catch (e) {
        reject(e);
      }
    });
  }
}

export async function openFhirDocumentation(): Promise<void> {
  const document = window.activeTextEditor.document;
  const startPosition = window.activeTextEditor.selection.start;
  if (document && startPosition) {
    const name = getFhirDocumentationName(document, startPosition);
    const uriToOpen = getDocumentationUri(name);
    if (await isDocumentationUriValid(uriToOpen.toString())) {
      env.openExternal(uriToOpen);
    } else {
      window.showInformationMessage(`No FHIR documentation for ${name}`);
    }
  }
}

export function activate(context: ExtensionContext): void {
  context.subscriptions.push(
    languages.registerDefinitionProvider(FSH_MODE, new FshDefinitionProvider())
  );
  commands.registerCommand('extension.openFhir', openFhirDocumentation);
}

export function getTargetName(document: TextDocument, position: Position): string {
  // What is the name of the thing we want to get a definition of?
  // An entity's name can have most any non-whitespace character in it,
  // so use our own word regex instead of the default one.
  return document.getText(document.getWordRangeAtPosition(position, /[^\s\(\)#]+/));
}

export function getDefinitionLocation(target: string): Location {
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

  for (const [filepath, doc] of parsedFsh) {
    // look for a keyword that starts a definition
    // Alias, CodeSystem, Extension, Instance, Invariant, Mapping, Profile,
    // RuleSet, ValueSet
    if (doc.entity() && doc.entity().length > 0) {
      for (const entity of doc.entity()) {
        // some entities work a little differently
        if (entity.alias()) {
          if (target === entity.alias().SEQUENCE()[0].getText()) {
            return new Location(Uri.file(filepath), new Position(entity.alias().start.line - 1, 0));
          }
        } else if (entity.ruleSet()) {
          if (target === entity.ruleSet().RULESET_REFERENCE().getText().trim()) {
            return new Location(
              Uri.file(filepath),
              new Position(entity.ruleSet().start.line - 1, 0)
            );
          }
        } else if (entity.paramRuleSet()) {
          const rulesetReference = entity.paramRuleSet().PARAM_RULESET_REFERENCE().getText();
          const paramListStart = rulesetReference.indexOf('(');
          const name = rulesetReference.slice(0, paramListStart).trim();
          if (target === name) {
            return new Location(
              Uri.file(filepath),
              new Position(entity.paramRuleSet().start.line - 1, 0)
            );
          }
        } else {
          const typedEntity =
            entity.profile() ??
            entity.extension() ??
            entity.instance() ??
            entity.valueSet() ??
            entity.codeSystem() ??
            entity.invariant() ??
            entity.mapping();
          if (target === typedEntity.name().getText()) {
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
  if (stats.isDirectory()) {
    fs.readdirSync(filepath).forEach(file => {
      collectFshFilesForPath(path.join(filepath, file), fshFiles);
    });
  } else if (filepath.endsWith('.fsh')) {
    fshFiles.push(filepath);
  }
  return fshFiles;
}

export function getFhirDocumentationName(document: TextDocument, position: Position): string {
  // slightly modified form of the FHIR regular expression for name
  // FHIR wants the first character to be a capital letter, but we don't require that
  // The special case for Extension is to let us differentiate between cases where it is
  // used as a FSH entity and where it is used as a FHIR type.
  return document
    .getText(document.getWordRangeAtPosition(position, /Extension\s*:|\w{1,255}/))
    .replace(/\s/, ''); // If we matched the Extension special case, remove any spaces between Extension and :
}

export function getDocumentationUri(name: string): Uri {
  const lowerName = name.toLowerCase();
  if (SPECIAL_URLS.has(lowerName)) {
    return SPECIAL_URLS.get(lowerName);
  } else {
    return Uri.parse(`https://hl7.org/fhir/${lowerName}.html`, true);
  }
}

export async function isDocumentationUriValid(uriToOpen: string): Promise<boolean> {
  try {
    await axios.head(uriToOpen, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}
