import { Uri, TextDocumentContentProvider, EventEmitter, workspace, OutputChannel } from 'vscode';
import path, { basename, dirname } from 'path';
import YAML from 'yaml';
import { SushiConfiguration } from './utils';
import { fshMap, ResourceMap } from 'gofsh/dist/api'; //Check review comment in extenison.ts

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

export function createFSHURIfromFileUri(identifier: string): Uri {
  return createURIfromFileUri(identifier, '.fsh');
}

export function createJSONURIfromFileUri(identifier: string): Uri {
  return createURIfromFileUri(identifier, '.json');
}

function createURIfromFileUri(identifier: string, extension: string): Uri {
  //Get the file name without the extension
  return Uri.parse(
    FshConversionProvider.fshConversionProviderScheme +
      ': (PREVIEW) ' +
      identifier +
      extension
  );
}

export async function findConfiguration(
  fileUri: Uri,
  output: OutputChannel
): Promise<{ canonical: string; version: string; dependencies: string[]; sushiconfig: Uri }> {
  let fhirVersion = '4.0.1';
  let canonical = 'http://example.org';
  const conversionDependencies: string[] = [];

  const sushiConfigUri = await findMatchingSushiConfig(fileUri);
  if (sushiConfigUri) {
    output.appendLine('Sushi-config.yaml file found: ' + sushiConfigUri.fsPath);

    const configContents = await workspace.fs.readFile(sushiConfigUri);

    const decoder = new TextDecoder();
    const decodedConfig = decoder.decode(configContents);
    const parsedConfig = YAML.parse(decodedConfig);

    fhirVersion = getVersionFromSushiConfig(parsedConfig);
    output.appendLine('Found version: ' + fhirVersion);

    canonical = getCanonicalFromSushiConfig(parsedConfig);
    output.appendLine('Found canonical: ' + canonical);

    const dependencies = getDependenciesFromSushiConfig(parsedConfig);
    dependencies.forEach(dep => {
      output.appendLine('Found dependency: ' + dep.packageId + '@' + dep.version);
      conversionDependencies.push(dep.packageId + '@' + dep.version);
    });
  } else {
    output.appendLine('No sushi-config.yaml file found.');
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
    .find(version => /current|4\.0\.1|4\.[1-9]\d*\.\d+|5\.\d+\.\d+/.test(version));

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

export function findNamesInFSHResource(fshContent: string): string[] {
  const ids: string[] = [];
  const lines = fshContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('CodeSystem:')) {
      ids.push(line.split(' ')[1].trim());
    } else if (line.startsWith('Instance:')) {
      ids.push(line.split(' ')[1].trim());
    } else if (line.startsWith('ValueSet:')) {
      ids.push(line.split(' ')[1].trim());
    } else if (line.startsWith('ConceptMap:')) {
      ids.push(line.split(' ')[1].trim());
    } else if (line.startsWith('Profile:')) {
      ids.push(line.split(' ')[1].trim());
    } else if (line.startsWith('Extension:')) {
      ids.push(line.split(' ')[1].trim());
    }
  }
  return ids;
}

export function findFSHResourceInResult(fshResult: fshMap, resourceId: string): string {

  let resourceContent = fshResult.aliases + '\n\n';

  const resultKeys: string[] = [
    'mappings', 'profiles', 'extensions', 'logicals', 'resources', 'codeSystems', 'valueSets', 'instances'
  ];

  for (const [key, resourceMap] of Object.entries(fshResult)) {
    if (resultKeys.includes(key)) {
      (resourceMap as ResourceMap).forEach((value, id) => {
        if (id === resourceId) {
          resourceContent += value;
        }
      });
    }
  }

  return resourceContent;
};
