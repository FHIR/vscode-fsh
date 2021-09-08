import {
  CompletionItemProvider,
  TextDocument,
  Position,
  ProviderResult,
  CompletionItem,
  CompletionList,
  Range,
  workspace,
  Uri
} from 'vscode';
import { EntityType, FshDefinitionProvider } from './FshDefinitionProvider';
import path = require('path');

export type PackageContents = {
  files: {
    filename: string;
    resourceType: string;
    id: string;
    url: string;
    type?: string;
    kind?: string;
  }[];
};

export class FshCompletionProvider implements CompletionItemProvider {
  fhirEntities: {
    resources: CompletionItem[];
    extensions: CompletionItem[];
    codeSystems: CompletionItem[];
    valueSets: CompletionItem[];
  } = { resources: [], extensions: [], codeSystems: [], valueSets: [] };

  constructor(private definitionProvider: FshDefinitionProvider) {}

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

  public async updateFhirEntities(cachePath: string): Promise<void> {
    if (cachePath && path.isAbsolute(cachePath)) {
      let packagePath = cachePath;
      try {
        await workspace.fs.stat(Uri.file(packagePath));
        // we expect this to be the path that ends in .fhir
        // but the user may have gone deeper
        // so be kind of flexible about it
        // first, dive into "packages"
        try {
          await workspace.fs.stat(Uri.file(path.join(packagePath, 'packages')));
          packagePath = path.join(packagePath, 'packages');
        } catch (err) {
          // Couldn't dive into "packages". But that might be okay.
        }
        // then, dive into the fhir core package
        // default is to go with hl7.fhir.r4.core#version
        try {
          await workspace.fs.stat(Uri.file(path.join(packagePath, 'hl7.fhir.r4.core#4.0.1')));
          packagePath = path.join(packagePath, 'hl7.fhir.r4.core#4.0.1');
        } catch (err) {
          // Couldn't dive into "hl7.fhir.r4.core#4.0.1". But that might be okay.
        }
        // then, one more dive, into the "package" directory
        try {
          await workspace.fs.stat(Uri.file(path.join(packagePath, 'package')));
          packagePath = path.join(packagePath, 'package');
        } catch (err) {
          // Couldn't dive into "package". But that might be okay.
        }
      } catch (err) {
        // if we're out here, the initial stat failed, which meant we couldn't stat the directory the user provided.
        // so, nothing we can do.
        throw new Error(`Couldn't load FHIR definitions from path: ${packagePath}`);
      }
      // then, we're done diving. we should have a file named .index.json, which will tell us what we want to know
      try {
        const fileContents = await workspace.fs.readFile(
          Uri.file(path.join(packagePath, '.index.json'))
        );
        const decoder = new TextDecoder();
        const decodedContents = decoder.decode(fileContents);
        const parsedContents = JSON.parse(decodedContents) as PackageContents;
        this.processPackageContents(parsedContents);
      } catch (err) {
        throw new Error("Couldn't read definition information from FHIR package.");
      }
    }
  }

  public processPackageContents(packageIndex: PackageContents): void {
    if (packageIndex.files?.length) {
      const updatedEntities: FshCompletionProvider['fhirEntities'] = {
        resources: [],
        extensions: [],
        codeSystems: [],
        valueSets: []
      };
      packageIndex.files.forEach(entityInfo => {
        if (entityInfo.resourceType === 'StructureDefinition') {
          if (entityInfo.type === 'Extension') {
            const item = new CompletionItem(entityInfo.id);
            item.detail = 'FHIR Extension';
            updatedEntities.extensions.push(item);
          } else if (entityInfo.id === entityInfo.type) {
            const item = new CompletionItem(entityInfo.id);
            item.detail = 'FHIR Resource';
            updatedEntities.resources.push(item);
            // This condition will succeed for FHIR types and resources, but fail for examples.
          }
        } else if (entityInfo.resourceType === 'ValueSet') {
          const item = new CompletionItem(entityInfo.id);
          item.detail = 'FHIR ValueSet';
          updatedEntities.valueSets.push(item);
        } else if (entityInfo.resourceType === 'CodeSystem') {
          const item = new CompletionItem(entityInfo.id);
          item.detail = 'FHIR CodeSystem';
          updatedEntities.codeSystems.push(item);
        }
      });
      this.fhirEntities = updatedEntities;
    }
  }

  public getEntityItems(allowedTypes: EntityType[]): CompletionItem[] {
    const entityItems: CompletionItem[] = [];
    this.definitionProvider.nameInformation.forEach((info, name) => {
      if (info.map(info => info.type).some(presentType => allowedTypes.includes(presentType))) {
        const item = new CompletionItem(name);
        item.detail = info
          .map(info => info.type)
          .sort()
          .join(', ');
        entityItems.push(item);
      }
    });
    return entityItems;
  }

  public getFhirItems(allowedTypes: EntityType[]): CompletionItem[] {
    const fhirItems: CompletionItem[] = [];
    if (allowedTypes.includes('Resource')) {
      fhirItems.push(...this.fhirEntities.resources);
    }
    if (allowedTypes.includes('Extension')) {
      fhirItems.push(...this.fhirEntities.extensions);
    }
    if (allowedTypes.includes('CodeSystem')) {
      fhirItems.push(...this.fhirEntities.codeSystems);
    }
    if (allowedTypes.includes('ValueSet')) {
      fhirItems.push(...this.fhirEntities.valueSets);
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
