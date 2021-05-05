import {
  DefinitionProvider,
  FileSystemWatcher,
  workspace,
  Uri,
  Position,
  TextDocument,
  Location
} from 'vscode';

import { getTreeForText } from './parser';
import { collectFshFilesForPath, getTargetName } from './utils';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export class FshDefinitionProvider implements DefinitionProvider {
  // nameLocations provides a map from a name to all of that name's locations.
  nameLocations: Map<string, Location[]> = new Map();
  // fileNames provides a map from a file path to all of the names in that file
  fileNames: Map<string, string[]> = new Map();
  // latestHashes provides a map from a file path to that file's most recent hash
  latestHashes: Map<string, string> = new Map();
  // fsWatcher keeps an eye on the workspace for filesystem events
  fsWatcher: FileSystemWatcher;

  constructor() {
    if (workspace && workspace.workspaceFolders) {
      this.scanAll();
      this.fsWatcher = workspace.createFileSystemWatcher('**/*');
      this.fsWatcher.onDidChange(this.updateNamesFromFile, this);
      this.fsWatcher.onDidCreate(this.updateNamesFromFile, this);
      this.fsWatcher.onDidDelete(this.handleDeletedFile, this);
    }
  }

  public scanAll(): void {
    this.nameLocations.clear();
    this.fileNames.clear();
    this.latestHashes.clear();
    // get all our fsh files
    const fshFiles: string[] = [];
    workspace.workspaceFolders.forEach(folder => {
      const folderPath = folder.uri.fsPath;
      collectFshFilesForPath(folderPath, fshFiles);
    });
    fshFiles.forEach(fshFile => {
      const fileText = fs.readFileSync(fshFile).toString();
      const doc = getTreeForText(fileText);
      this.fileNames.set(fshFile, []);
      // look for a keyword that starts a definition
      // Alias, CodeSystem, Extension, Instance, Invariant, Mapping, Profile,
      // RuleSet, ValueSet
      if (doc.entity() && doc.entity().length > 0) {
        for (const entity of doc.entity()) {
          const { name, startLine } = getNameAndLine(entity);
          // if we found a name, add it to our maps
          if (name) {
            this.fileNames.get(fshFile).push(name);
            if (!this.nameLocations.has(name)) {
              this.nameLocations.set(name, []);
            }
            this.nameLocations
              .get(name)
              .push(new Location(Uri.file(fshFile), new Position(startLine, 0)));
          }
        }
      }
      const hash = crypto.createHash('sha256');
      hash.update(fileText);
      const newHash = hash.digest().toString();
      this.latestHashes.set(fshFile, newHash);
    });
  }

  public updateNamesFromFile(filepath: string | Uri, file?: TextDocument): void {
    if (file) {
      filepath = file.uri.fsPath;
    } else if (filepath instanceof Uri) {
      filepath = filepath.fsPath;
    }
    const fshFiles: string[] = [];
    collectFshFilesForPath(filepath, fshFiles);
    fshFiles.forEach(fshFile => {
      const fileText = file ? file.getText() : fs.readFileSync(fshFile).toString();
      // check our latest hashes to see if we've already dealt with this
      const hash = crypto.createHash('sha256');
      hash.update(fileText);
      const newHash = hash.digest().toString();
      if (this.latestHashes.get(fshFile) !== newHash) {
        // a different hash means we have work to do!
        // if this file has already been parsed,
        // clear out its old data from nameLocations.
        if (this.fileNames.has(fshFile)) {
          const affectedNames = this.fileNames.get(fshFile);
          affectedNames.forEach(name => {
            const oldLocations = this.nameLocations.get(name) ?? [];
            this.nameLocations.set(
              name,
              oldLocations.filter(location => {
                return location.uri.fsPath !== fshFile;
              })
            );
            // if a name has no remaining locations, it's gone!
            if (this.nameLocations.get(name).length === 0) {
              this.nameLocations.delete(name);
            }
          });
        }
        // parse this file and add updated data
        const doc = getTreeForText(fileText);
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
                .push(new Location(Uri.file(fshFile), new Position(startLine, 0)));
            }
          }
        }
        this.fileNames.set(fshFile, newNames);
        this.latestHashes.set(fshFile, newHash);
      }
    });
  }

  public handleDeletedFile(filepath: string | Uri): void {
    if (filepath instanceof Uri) {
      filepath = filepath.fsPath;
    }
    // We may receive a path to a single file, or a path to a directory.
    // A file is considered a match if the received path is an exact match,
    // or if the received path is a directory that is an ancestor of the file.
    Array.from(this.fileNames.keys()).forEach(knownFile => {
      if (knownFile === filepath || knownFile.startsWith(`${filepath}${path.sep}`)) {
        // remove any locations pointing to this file
        const affectedNames = this.fileNames.get(knownFile);
        affectedNames.forEach(name => {
          const oldLocations = this.nameLocations.get(name) ?? [];
          const newLocations = oldLocations.filter(location => {
            return location.uri.fsPath !== knownFile;
          });
          // if a name has no remaining locations, it's gone!
          if (newLocations.length) {
            this.nameLocations.set(name, newLocations);
          } else {
            this.nameLocations.delete(name);
          }
        });
        // remove this file from the fileNames and latestHashes maps
        this.fileNames.delete(knownFile);
        this.latestHashes.delete(knownFile);
      }
    });
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
