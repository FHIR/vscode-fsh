import { Uri, TextDocumentContentProvider, EventEmitter, workspace, OutputChannel } from 'vscode';
import { basename, dirname } from 'path';
import YAML from 'yaml';
import { SushiConfiguration } from './utils';

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

export function createFSHURIfromFileUri(fileUri: Uri, prefix: string): Uri {
  return createURIfromFileUri(fileUri, '.fsh', prefix);
}

export function createJSONURIfromFileUri(fileUri: Uri, prefix: string): Uri {
  return createURIfromFileUri(fileUri, '.json', prefix);
}

function createURIfromFileUri(fileUri: Uri, extension: string, prefix: string): Uri {
  //Get the file name without the extension
  let fileName = basename(fileUri.path);
  fileName = fileName.split('.').slice(0, -1).join('.');

  return Uri.parse(
    FshConversionProvider.fshConversionProviderScheme +
      ': (PREVIEW) ' +
      prefix +
      fileName +
      extension
  );
}

export async function findVersionAnddependencies(
  fileUri: Uri,
  output: OutputChannel
): Promise<{ version: string; dependencies: string[] }> {
  let fhirVersion = '4.0.1';
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

    const dependencies = getDependenciesFromSushiConfig(parsedConfig);
    dependencies.forEach(dep => {
      output.appendLine('Found dependency: ' + dep.packageId + '@' + dep.version);
      conversionDependencies.push(dep.packageId + '@' + dep.version);
    });
  } else {
    output.appendLine('No sushi-config.yaml file found.');
  }

  return { version: fhirVersion, dependencies: conversionDependencies };
}

async function findMatchingSushiConfig(fileUri: Uri): Promise<Uri> {
  return new Promise(resolve => {
    workspace.findFiles('**/sushi-config.{yaml,yml}').then(files => {
      let sushiConfigUri = null;
      files.forEach(file => {
        const configdir = dirname(file.fsPath);
        if (fileUri.fsPath.startsWith(configdir)) {
          sushiConfigUri = file;
        }
      });
      resolve(sushiConfigUri);
    });
  });
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
