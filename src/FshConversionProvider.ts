import { Uri, TextDocumentContentProvider, EventEmitter, workspace, OutputChannel } from 'vscode';
import path, { dirname } from 'path';
import YAML from 'yaml';
import { SushiConfiguration } from './utils';
import { gofshClient } from 'gofsh/dist';
import { all } from 'axios';
import { FHIRResource } from 'gofsh/dist/processor';

export class FshConversionProvider implements TextDocumentContentProvider {
  static readonly fshConversionProviderScheme = 'fshfhirconversion';
  private mapContent = new Map<string, string>();

  private onDidChangeEmitter = new EventEmitter<Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }

  updated(newContent: string, newUri: Uri): void {
    this.mapContent.set(newUri.fsPath, newContent);

    this.onDidChangeEmitter.fire(newUri);
  }

  provideTextDocumentContent(uri: Uri): string {
    return this.mapContent.get(uri.fsPath);
  }
}

export function createFSHURIfromIdentifier(identifier: string): Uri {
  return createURIfromIdentifier(identifier, '.fsh');
}

export function createJSONURIfromIdentifier(identifier: string): Uri {
  return createURIfromIdentifier(identifier, '.json');
}

function createURIfromIdentifier(identifier: string, extension: string): Uri {
  //Get the file name without the extension
  return Uri.parse(
    FshConversionProvider.fshConversionProviderScheme + ': (PREVIEW) ' + identifier + extension
  );
}

export async function findConfiguration(
  fileUri: Uri,
  output?: OutputChannel
): Promise<{ canonical: string; version: string; dependencies: string[]; sushiconfig: Uri }> {
  let fhirVersion = '4.0.1';
  let canonical = 'http://example.org';
  const conversionDependencies: string[] = [];

  const sushiConfigUri = await findMatchingSushiConfig(fileUri);
  if (sushiConfigUri) {
    output !== undefined ? output.appendLine('Sushi-config.yaml file found: ' + sushiConfigUri.fsPath) : null;

    const configContents = await workspace.fs.readFile(sushiConfigUri);

    const decoder = new TextDecoder();
    const decodedConfig = decoder.decode(configContents);
    const parsedConfig = YAML.parse(decodedConfig);

    fhirVersion = getVersionFromSushiConfig(parsedConfig);
    output !== undefined ?  output.appendLine('Found version: ' + fhirVersion) : null;

    canonical = getCanonicalFromSushiConfig(parsedConfig);
    output !== undefined ?  output.appendLine('Found canonical: ' + canonical) : null;

    const dependencies = getDependenciesFromSushiConfig(parsedConfig);
    dependencies.forEach(dep => {
      output !== undefined ?  output.appendLine('Found dependency: ' + dep.packageId + '#' + dep.version) : null;
      conversionDependencies.push(dep.packageId + '@' + dep.version);
    });
  } else {
    // TODO: Look for and use an ImplementationGuide JSON file if there is no sushi-config.yaml
    output !== undefined ?  output.appendLine('No sushi-config.yaml file found.') : null;
  }

  return {
    canonical: canonical,
    version: fhirVersion,
    dependencies: conversionDependencies,
    sushiconfig: sushiConfigUri
  };
}

async function findMatchingSushiConfig(fileUri: Uri): Promise<Uri> {
  return new Promise(resolve => {
    workspace.findFiles('**/sushi-config.{yaml,yml}').then(files => {
      let sushiConfigUri = null;
      files.forEach(file => {
        const configdir = dirname(file.fsPath) + path.sep;
        if (fileUri.fsPath.startsWith(configdir)) {
          sushiConfigUri = file;
        }
      });
      resolve(sushiConfigUri);
    });
  });
}

function getCanonicalFromSushiConfig(config: SushiConfiguration): string {
  // try to get canonical: if there's more than one, use the first one that is recognized
  return config.canonical !== undefined ? config.canonical : 'http://example.org';
}

function getVersionFromSushiConfig(config: SushiConfiguration): string {
  // try to get fhirVersion: if there's more than one, use the first one that is recognized
  let fhirVersion = '4.0.1';
  const listedVersions = Array.isArray(config.fhirVersion)
    ? config.fhirVersion
    : [config.fhirVersion];
  fhirVersion = listedVersions
    .map(version => {
      const versionMatch = version?.match(/^#?(\S*)/);
      if (versionMatch) {
        return versionMatch[1];
      } else {
        return null;
      }
    })
    .find(version => /current|4\.0\.1|4\.[1-9]\d*\.\d+|[56]\.\d+\.\d+/.test(version));

  return fhirVersion;
}

function getDependenciesFromSushiConfig(
  config: SushiConfiguration
): { packageId: string; version: string }[] {
  //try to get dependencies: more or less doing SUSHI's importConfiguration.parseDependencies
  let parsedDependencies: { packageId: string; version: string }[] = [];
  if (config.dependencies) {
    parsedDependencies = Object.entries(config.dependencies).map(
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
  return parsedDependencies;
}

export async function findMatchingFSHResourcesForProject(configFileUri: Uri): Promise<string[]> {
  const fshResources: string[] = [];
  const configdir = dirname(configFileUri.fsPath) + path.sep;
  const files: Uri[] = await workspace.findFiles('**/*.{fsh}');

  for (const file of files) {
    if (file.fsPath.startsWith(configdir)) {
      //Found FSH resource belonging to project.
      const contents = await workspace.fs.readFile(file);
      const decoder = new TextDecoder();
      const decodedContents = decoder.decode(contents);
      fshResources.push(decodedContents);
    }
  }

  return fshResources;
}

export async function findMatchingJsonResourcesForProject(configFileUri: Uri): Promise<string[]> {
  const jsonResources: string[] = [];
  const configdir = dirname(configFileUri.fsPath) + path.sep;
  const files: Uri[] = await workspace.findFiles('**/*.{json}');

  for (const file of files) {
    if (file.fsPath.startsWith(configdir)) {
      //Found FSH resource belonging to project.
      const contents = await workspace.fs.readFile(file);
      const decoder = new TextDecoder();
      const decodedContents = decoder.decode(contents);
      jsonResources.push(decodedContents);
    }
  }

  return jsonResources;
}

export async function findNamesInFSHResource(fshResource: Uri): Promise<string[]> {
  const ids: string[] = [];

  const fshContent = await workspace.fs.readFile(fshResource);
  const decoder = new TextDecoder();
  const fshString = decoder.decode(fshContent);

  const lines = fshString.split('\n');
  for (const line of lines) {
    const match = line.match(/(Instance|Profile|Extension|ValueSet|CodeSystem|Logical|Resource)\s*:\s*(\S*)/);
    if (match) {
      ids.push(match[2]);
    }
  }

  return ids;
}

export function findFSHResourceInResult(fshResult: gofshClient.fshMap, resourceId: string): string {
  let resourceContent = fshResult.aliases + '\n\n';

  const resultKeys: string[] = [
    'mappings',
    'profiles',
    'extensions',
    'logicals',
    'resources',
    'codeSystems',
    'valueSets',
    'instances'
  ];

  for (const [key, resourceMap] of Object.entries(fshResult)) {
    if (resultKeys.includes(key)) {
      (resourceMap as gofshClient.ResourceMap).forEach((value, id) => {
        if (id === resourceId) {
          resourceContent += value;
        }
      });
    }
  }

  return resourceContent;
}

export function findJsonResourcesInResult(fshResult: any[], resourceIds: string[]): any[] {
  const resources: any[] = [];
  fshResult.forEach(resource => {
    if (resourceIds.includes(resource.id) || (resource.name && resourceIds.includes(resource.name)) ) {
      const formattedText = JSON.stringify(resource, null, 2);
      resources.push(formattedText);
    }
  });
  return resources;
}

