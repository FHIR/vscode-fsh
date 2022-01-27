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

export type EntityType =
  | 'Alias'
  | 'RuleSet'
  | 'Profile'
  | 'Extension'
  | 'Logical'
  | 'Resource'
  | 'Instance'
  | 'ValueSet'
  | 'CodeSystem'
  | 'Invariant'
  | 'Mapping';

export type MetadataField = 'id' | 'parent' | 'instanceOf';

export type NameInfo = {
  location: Location;
  type: EntityType;
  id: string;
  parent: string;
  instanceOf: string;
};

export class FshDefinitionProvider implements DefinitionProvider {
  // nameInformation provides a map from a name to all of that name's locations and types
  nameInformation: Map<string, NameInfo[]> = new Map();
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
    this.nameInformation.clear();
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
          const { name, id, startLine, entityType, parent, instanceOf } = getEntityDetails(entity);
          // if we found a name, add it to our maps
          if (name) {
            this.fileNames.get(fshFile).push(name);
            if (!this.nameInformation.has(name)) {
              this.nameInformation.set(name, []);
            }
            this.nameInformation.get(name).push({
              location: new Location(Uri.file(fshFile), new Position(startLine, 0)),
              type: entityType,
              id,
              parent,
              instanceOf
            });
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
        // clear out its old data from nameInformation.
        if (this.fileNames.has(fshFile)) {
          const affectedNames = this.fileNames.get(fshFile);
          affectedNames.forEach(name => {
            const oldInformation = this.nameInformation.get(name) ?? [];
            this.nameInformation.set(
              name,
              oldInformation.filter(nameInfo => {
                return nameInfo.location.uri.fsPath !== fshFile;
              })
            );
            // if a name has no remaining information, it's gone!
            if (this.nameInformation.get(name).length === 0) {
              this.nameInformation.delete(name);
            }
          });
        }
        // parse this file and add updated data
        const doc = getTreeForText(fileText);
        const newNames: string[] = [];
        if (doc.entity() && doc.entity().length > 0) {
          for (const entity of doc.entity()) {
            const { name, id, startLine, entityType, parent, instanceOf } = getEntityDetails(
              entity
            );
            // if we found a name, add it to our maps
            if (name) {
              newNames.push(name);
              if (!this.nameInformation.has(name)) {
                this.nameInformation.set(name, []);
              }
              this.nameInformation.get(name).push({
                location: new Location(Uri.file(fshFile), new Position(startLine, 0)),
                type: entityType,
                id,
                parent,
                instanceOf
              });
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
          const oldInformation = this.nameInformation.get(name) ?? [];
          const newInformation = oldInformation.filter(nameInfo => {
            return nameInfo.location.uri.fsPath !== knownFile;
          });
          // if a name has no remaining information, it's gone!
          if (newInformation.length) {
            this.nameInformation.set(name, newInformation);
          } else {
            this.nameInformation.delete(name);
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
        resolve(this.nameInformation.get(name).map(info => info.location));
      } catch (e) {
        reject(e);
      }
    });
  }
}

function getEntityDetails(
  entity: any
): {
  name: string;
  id: string;
  parent: string;
  instanceOf: string;
  startLine: number;
  entityType: EntityType;
} {
  let name: string;
  let id: string;
  let parent: string;
  let instanceOf: string;
  let startLine: number;
  let entityType: EntityType;
  // some entities work a little differently
  if (entity.alias()) {
    name = entity.alias().SEQUENCE()[0].getText();
    startLine = entity.alias().start.line - 1;
    entityType = 'Alias';
  } else if (entity.ruleSet()) {
    name = entity.ruleSet().RULESET_REFERENCE().getText().trim();
    startLine = entity.ruleSet().start.line - 1;
    entityType = 'RuleSet';
  } else if (entity.paramRuleSet()) {
    const rulesetReference = entity.paramRuleSet().PARAM_RULESET_REFERENCE().getText();
    const paramListStart = rulesetReference.indexOf('(');
    name = rulesetReference.slice(0, paramListStart).trim();
    startLine = entity.paramRuleSet().start.line - 1;
    entityType = 'RuleSet';
  } else {
    let typedEntity: any;
    if (entity.profile()) {
      typedEntity = entity.profile();
      entityType = 'Profile';
      if (typedEntity.sdMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.sdMetadata());
        parent = getParentFromMetadata(typedEntity.sdMetadata());
      }
    } else if (entity.extension()) {
      typedEntity = entity.extension();
      entityType = 'Extension';
      if (typedEntity.sdMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.sdMetadata());
        parent = getParentFromMetadata(typedEntity.sdMetadata());
      }
    } else if (entity.logical()) {
      typedEntity = entity.logical();
      entityType = 'Logical';
      if (typedEntity.sdMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.sdMetadata());
      }
    } else if (entity.resource()) {
      typedEntity = entity.resource();
      entityType = 'Resource';
      if (typedEntity.sdMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.sdMetadata());
      }
    } else if (entity.instance()) {
      typedEntity = entity.instance();
      entityType = 'Instance';
      if (typedEntity.instanceMetadata()?.length > 0) {
        instanceOf = getInstanceOfFromMetadata(typedEntity.instanceMetadata());
      }
    } else if (entity.valueSet()) {
      typedEntity = entity.valueSet();
      entityType = 'ValueSet';
      if (typedEntity.vsMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.vsMetadata());
      }
    } else if (entity.codeSystem()) {
      typedEntity = entity.codeSystem();
      entityType = 'CodeSystem';
      if (typedEntity.csMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.csMetadata());
      }
    } else if (entity.invariant()) {
      typedEntity = entity.invariant();
      entityType = 'Invariant';
    } else {
      typedEntity = entity.mapping();
      entityType = 'Mapping';
      if (typedEntity.mappingMetadata()?.length > 0) {
        id = getIdFromMetadata(typedEntity.mappingMetadata());
      }
    }
    name = typedEntity.name().getText();
    startLine = typedEntity.start.line - 1;
  }
  return {
    name,
    id,
    startLine,
    entityType,
    parent,
    instanceOf
  };
}

function getIdFromMetadata(metadata: { id: () => any }[]): string {
  for (const meta of metadata) {
    if (meta.id()) {
      return meta.id().name().getText();
    }
  }
}

function getParentFromMetadata(metadata: { parent: () => any }[]): string {
  for (const meta of metadata) {
    if (meta.parent()) {
      return meta.parent().name().getText();
    }
  }
}

function getInstanceOfFromMetadata(metadata: { instanceOf: () => any }[]): string {
  for (const meta of metadata) {
    if (meta.instanceOf()) {
      return meta.instanceOf().name().getText();
    }
  }
}
