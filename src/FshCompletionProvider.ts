import {
  CompletionItemProvider,
  TextDocument,
  Position,
  ProviderResult,
  CompletionItem,
  CompletionList,
  Range,
  workspace,
  Uri,
  window,
  FileSystemWatcher,
  FileType
} from 'vscode';
import { EntityType, FshDefinitionProvider } from './FshDefinitionProvider';
import YAML from 'yaml';
import path from 'path';
import os from 'os';

export type FhirContents = {
  resourceType: string;
  type?: string;
  kind?: string;
  derivation?: string;
};

type DependencyDetails = {
  id: string;
  uri: string;
  version: string | number;
};

type SushiConfiguration = {
  fhirVersion?: string | string[];
  dependencies?: {
    [key: string]: string | number | DependencyDetails;
  };
};

type EntitySet = {
  profiles: CompletionItem[];
  resources: CompletionItem[];
  extensions: CompletionItem[];
  logicals: CompletionItem[];
  codeSystems: CompletionItem[];
  valueSets: CompletionItem[];
};

export class FshCompletionProvider implements CompletionItemProvider {
  fhirEntities: {
    [key: string]: EntitySet;
  } = {};
  cachedFhirEntities: {
    [key: string]: EntitySet;
  } = {};
  cachePath: string;
  // fsWatcher keeps an eye on the workspace for filesystem events
  fsWatcher: FileSystemWatcher;

  constructor(private definitionProvider: FshDefinitionProvider) {
    this.cachePath = path.join(os.homedir(), '.fhir', 'packages');
    this.fsWatcher = workspace.createFileSystemWatcher('**/sushi-config.{yaml,yml}');
    this.fsWatcher.onDidChange(this.updateFhirEntities, this);
    this.fsWatcher.onDidCreate(this.updateFhirEntities, this);
    this.fsWatcher.onDidDelete(this.updateFhirEntities, this);
  }

  public getAllowedTypesAndExtraNames(
    document: TextDocument,
    position: Position
  ): {
    allowedTypes: EntityType[];
    extraNames: CompletionItem[];
  } {
    // search backwards from our current position to get the right kinds of names
    // check the nearest non-empty line. don't just keep going forever
    // if we see "InstanceOf" we're making an instance, which means we want Profile, Resource, or Extension
    // if we see "obeys" we're setting an obeysRule, which means we want Invariant
    // if we see "Parent" keep looking, lots of things have parents
    // A Profile's parent can be a Profile, Logical,
    // An Extension's parent must also be an Extension
    // A Logical's parent must be a Logical or a Resource, or "Base" or "Element"
    // A Resource's parent must be "Resource" or "DomainResource"

    const currentLine = document.getText(
      new Range(position.line, 0, position.line, position.character)
    );
    let allowedTypes: EntityType[] = [];
    const extraNames: CompletionItem[] = [];
    if (currentLine.startsWith('InstanceOf:')) {
      allowedTypes = ['Profile', 'Resource', 'Extension'];
    } else if (currentLine.match(/^[ \t]*\* (\S+ )?obeys/)) {
      allowedTypes = ['Invariant'];
    } else if (currentLine.startsWith('Parent:')) {
      // find the most recent non-empty line
      let previousLineNumber: number;
      for (previousLineNumber = position.line - 1; previousLineNumber >= 0; previousLineNumber--) {
        const previousLine = document
          .getText(new Range(previousLineNumber, 0, previousLineNumber + 1, 0))
          .trim();
        if (previousLine.length > 0) {
          if (previousLine.match(/Profile:/)) {
            allowedTypes = ['Profile', 'Logical', 'Resource', 'Extension'];
            break;
          } else if (previousLine.match(/Extension:/)) {
            allowedTypes = ['Extension'];
            break;
          } else if (previousLine.match(/Logical:/)) {
            allowedTypes = ['Logical', 'Resource'];
            extraNames.push(new CompletionItem('Base'), new CompletionItem('Element'));
            break;
          } else if (previousLine.match(/Resource:/)) {
            // a Resource can only have Resource or DomainResource as a parent, so no types are allowed
            extraNames.push(new CompletionItem('Resource'), new CompletionItem('DomainResource'));
            break;
          } else {
            // we found Parent: without something we understand before it, so give up
            return null;
          }
        }
      }
      // if we somehow make it to the top without any non-empty lines, give up
      if (previousLineNumber < 0) {
        return null;
      }
    } else {
      // we're not in a position where we're trying to be clever about autocomplete,
      // so this provider has nothing to help with
      return null;
    }
    return { allowedTypes, extraNames };
  }

  public async updateFhirEntities(): Promise<void> {
    if (this.cachePath && path.isAbsolute(this.cachePath)) {
      let fhirPackage = 'hl7.fhir.r4.core';
      let fhirVersion = '4.0.1';
      let parsedConfig: SushiConfiguration;
      let parsedDependencies: { packageId: string; version: string }[] = [];
      // first check if packagePath is valid. if not, give up right away
      try {
        await workspace.fs.stat(Uri.file(this.cachePath));
      } catch (err) {
        throw new Error(`Couldn't load FHIR definitions from path: ${this.cachePath}`);
      }
      // then, see if we have a configuration. if so, use it to try to set the dependencies.
      const configFiles = await workspace.findFiles('sushi-config.{yaml,yml}');
      if (configFiles.length > 0) {
        try {
          const configContents = await workspace.fs.readFile(configFiles[0]);
          const decoder = new TextDecoder();
          const decodedConfig = decoder.decode(configContents);
          parsedConfig = YAML.parse(decodedConfig);
          // try to get fhirVersion: if there's more than one, use the first one that is recognized
          const listedVersions = Array.isArray(parsedConfig.fhirVersion)
            ? parsedConfig.fhirVersion
            : [parsedConfig.fhirVersion];
          fhirVersion = listedVersions
            .map(version => {
              const versionMatch = version?.match(/^#?(\S*)/);
              if (versionMatch) {
                return versionMatch[1];
              } else {
                return null;
              }
            })
            .find(version => /current|4\.0\.1|4\.[1-9]\d*.\d+/.test(version));
          if (!fhirVersion) {
            fhirVersion = '4.0.1';
          } else if (/^4\.[13]\./.test(fhirVersion)) {
            fhirPackage = 'hl7.fhir.r4b.core';
          } else if (!fhirVersion.startsWith('4.0.')) {
            fhirPackage = 'hl7.fhir.r5.core';
          }
          // try to get dependencies: more or less doing SUSHI's importConfiguration.parseDependencies
          if (parsedConfig.dependencies) {
            parsedDependencies = Object.entries(parsedConfig.dependencies).map(
              ([packageId, versionOrDetails]) => {
                if (typeof versionOrDetails === 'string' || typeof versionOrDetails === 'number') {
                  return { packageId, version: `${versionOrDetails}` };
                } else if (versionOrDetails == null) {
                  return { packageId, version: undefined };
                } else {
                  return {
                    packageId,
                    version: versionOrDetails.version ? `${versionOrDetails.version}` : undefined
                  };
                }
              }
            );
          }
        } catch (err) {
          // there was a problem parsing the configuration. so, just ignore it, and hope we can find the default FHIR package.
        }
      }
      parsedDependencies.push({
        packageId: fhirPackage,
        version: fhirVersion
      });
      // then, try to actually process the resource files for all those packages.
      this.fhirEntities = await this.makeItemsFromDependencies(parsedDependencies);
    }
  }

  public async makeItemsFromDependencies(
    dependencies: { packageId: string; version: string }[]
  ): Promise<FshCompletionProvider['fhirEntities']> {
    const updatedEntities: FshCompletionProvider['fhirEntities'] = {};
    await Promise.all(
      dependencies.map(async dependency => {
        const packageKey = `${dependency.packageId}#${dependency.version}`;
        if (this.cachedFhirEntities[packageKey]) {
          // we already have it. assume it doesn't need to be reloaded
          updatedEntities[packageKey] = this.cachedFhirEntities[packageKey];
          return;
        }
        try {
          // for each json file in the package, open it up and see if it's something we can use.
          // there are naming conventions, but there's no need to rely on those.
          // we use a similar decision scheme to SUSHI's FHIRDefinitions.add() method.
          const packagePath = path.join(
            this.cachePath,
            `${dependency.packageId}#${dependency.version}`,
            'package'
          );
          const packageFiles = await workspace.fs.readDirectory(Uri.file(packagePath));
          const packageEntities: EntitySet = {
            profiles: [],
            resources: [],
            extensions: [],
            logicals: [],
            codeSystems: [],
            valueSets: []
          };
          await Promise.all(
            packageFiles.map(async ([fileName, type]) => {
              if (type == FileType.File && fileName.endsWith('.json')) {
                try {
                  const rawContents = await workspace.fs.readFile(
                    Uri.file(path.join(packagePath, fileName))
                  );
                  const decoder = new TextDecoder();
                  const decodedContents = decoder.decode(rawContents);
                  const parsedContents = JSON.parse(decodedContents);
                  const items: CompletionItem[] = [];
                  if (parsedContents.name) {
                    items.push(new CompletionItem(parsedContents.name));
                  }
                  if (parsedContents.id && parsedContents.name !== parsedContents.id) {
                    items.push(new CompletionItem(parsedContents.id));
                  }
                  switch (this.determineEntityType(parsedContents)) {
                    case 'Profile':
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} Profile`;
                        packageEntities.profiles.push(item);
                      });
                      break;
                    case 'Resource':
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} Resource`;
                        packageEntities.resources.push(item);
                      });
                      break;
                    case 'Type':
                      // a Type, such as Quantity, is allowed in the same contexts as a Resource
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} Type`;
                        packageEntities.resources.push(item);
                      });
                      break;
                    case 'Extension':
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} Extension`;
                        packageEntities.extensions.push(item);
                      });
                      break;
                    case 'Logical':
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} Logical`;
                        packageEntities.logicals.push(item);
                      });
                      break;
                    case 'CodeSystem':
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} CodeSystem`;
                        packageEntities.codeSystems.push(item);
                      });
                      break;
                    case 'ValueSet':
                      items.forEach(item => {
                        item.detail = `${dependency.packageId} ValueSet`;
                        packageEntities.valueSets.push(item);
                      });
                      break;
                  }
                } catch (err) {
                  // it might be unparseable JSON, or a file may have been removed between
                  // readDirectory and readFile. either way, it's okay. just keep going.
                }
              }
            })
          );
          this.cachedFhirEntities[packageKey] = packageEntities;
          updatedEntities[packageKey] = packageEntities;
        } catch (err) {
          window.showInformationMessage(
            `Could not load definition information for package ${dependency.packageId}#${dependency.version}`
          );
        }
        return;
      })
    );
    return updatedEntities;
  }

  public determineEntityType(fhirJson: FhirContents): EntityType | 'Type' {
    if (fhirJson.resourceType === 'StructureDefinition') {
      if (fhirJson.type === 'Extension') {
        return 'Extension';
      } else if (fhirJson.kind === 'logical') {
        if (fhirJson.derivation === 'specialization') {
          return 'Logical';
        } else {
          return 'Profile';
        }
      } else if (
        ['resource', 'primitive-type', 'complex-type', 'datatype'].includes(fhirJson.kind)
      ) {
        if (fhirJson.derivation === 'constraint') {
          return 'Profile';
        } else if (fhirJson.kind === 'resource') {
          return 'Resource';
        } else {
          return 'Type';
        }
      }
    } else if (fhirJson.resourceType === 'CodeSystem') {
      return 'CodeSystem';
    } else if (fhirJson.resourceType === 'ValueSet') {
      return 'ValueSet';
    }
    return null;
  }

  public getEntityItems(allowedTypes: EntityType[]): CompletionItem[] {
    const entityItems: CompletionItem[] = [];
    this.definitionProvider.nameInformation.forEach((info, name) => {
      const allowedInfo = info.filter(specificInfo => {
        return allowedTypes.includes(specificInfo.type);
      });
      if (allowedInfo.length > 0) {
        // add an item based on the name
        // list all of the types for that name, even though some of those types may not be currently allowed
        const item = new CompletionItem(name);
        item.detail = info
          .map(info => info.type)
          .sort()
          .join(', ');
        entityItems.push(item);
        // add items based on the id, when the id exists and is different than the name
        // these items only contain the type for the specific item
        allowedInfo.forEach(specificInfo => {
          if (specificInfo.id && specificInfo.id !== name) {
            const item = new CompletionItem(specificInfo.id);
            item.detail = specificInfo.type;
            entityItems.push(item);
          }
        });
      }
    });
    return entityItems;
  }

  public getFhirItems(allowedTypes: EntityType[]): CompletionItem[] {
    const fhirItems: CompletionItem[] = [];
    if (allowedTypes.includes('Profile')) {
      Object.values(this.fhirEntities)
        .map(fhirPackage => fhirPackage.profiles)
        .forEach(profiles => fhirItems.push(...profiles));
    }
    if (allowedTypes.includes('Resource')) {
      Object.values(this.fhirEntities)
        .map(fhirPackage => fhirPackage.resources)
        .forEach(resources => fhirItems.push(...resources));
    }
    if (allowedTypes.includes('Extension')) {
      Object.values(this.fhirEntities)
        .map(fhirPackage => fhirPackage.extensions)
        .forEach(extensions => fhirItems.push(...extensions));
    }
    if (allowedTypes.includes('Logical')) {
      Object.values(this.fhirEntities)
        .map(fhirPackage => fhirPackage.logicals)
        .forEach(logicals => fhirItems.push(...logicals));
    }
    if (allowedTypes.includes('CodeSystem')) {
      Object.values(this.fhirEntities)
        .map(fhirPackage => fhirPackage.codeSystems)
        .forEach(codeSystems => fhirItems.push(...codeSystems));
    }
    if (allowedTypes.includes('ValueSet')) {
      Object.values(this.fhirEntities)
        .map(fhirPackage => fhirPackage.valueSets)
        .forEach(valueSets => fhirItems.push(...valueSets));
    }
    return fhirItems;
  }

  public provideCompletionItems(
    document: TextDocument,
    position: Position
  ): ProviderResult<CompletionItem[] | CompletionList> {
    return new Promise((resolve, reject) => {
      try {
        this.definitionProvider.handleDirtyFiles();
        const allowedInfo = this.getAllowedTypesAndExtraNames(document, position);
        if (allowedInfo == null) {
          reject();
        } else {
          const { allowedTypes, extraNames } = allowedInfo;
          const fhirItems = this.getFhirItems(allowedTypes);
          const names = this.getEntityItems(allowedTypes);
          resolve(names.concat(extraNames, fhirItems));
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}
