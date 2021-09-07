import {
  languages,
  commands,
  window,
  ExtensionContext,
  DocumentFilter,
  TextDocument,
  Position,
  env,
  Uri,
  workspace
} from 'vscode';

import axios from 'axios';
import path from 'path';
import { FshDefinitionProvider } from './FshDefinitionProvider';
import { FshCompletionProvider, PackageContents } from './FshCompletionProvider';

const FSH_MODE: DocumentFilter = { language: 'fsh', scheme: 'file' };
// For FSH entity names and keywords, show the user FSH documentation.
// Extension has an unusual key pair in order to differentiate between cases
// where it is used as a FSH entity and where it is used as a type.
export const SPECIAL_URLS = new Map<string, Uri>([
  ['alias', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-aliases', true)],
  [
    'profile',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-profiles', true)
  ],
  ['extension', Uri.parse('https://hl7.org/fhir/extensibility.html', true)],
  [
    'extension:',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-extensions', true)
  ],
  [
    'invariant',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-invariants', true)
  ],
  [
    'instance',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-instances', true)
  ],
  [
    'valueset',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-value-sets', true)
  ],
  [
    'codesystem',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-code-systems', true)
  ],
  [
    'ruleset',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-rule-sets', true)
  ],
  [
    'mapping',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-mappings', true)
  ],
  [
    'logical',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-logical-models', true)
  ],
  [
    'resource',
    Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#defining-resources', true)
  ],
  ['from', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#binding-rules', true)],
  ['obeys', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#obeys-rules', true)],
  ['only', Uri.parse('https://hl7.org/fhir/uv/shorthand/reference.html#type-rules', true)],
  [
    'contains',
    Uri.parse(
      'https://hl7.org/fhir/uv/shorthand/reference.html#contains-rules-for-extensions',
      true
    )
  ]
]);

export function activate(
  context: ExtensionContext
): {
  definitionProviderInstance: FshDefinitionProvider;
  completionProviderInstance: FshCompletionProvider;
} {
  const definitionProviderInstance = new FshDefinitionProvider();
  const completionProviderInstance = new FshCompletionProvider(definitionProviderInstance);
  context.subscriptions.push(
    languages.registerDefinitionProvider(FSH_MODE, definitionProviderInstance),
    languages.registerCompletionItemProvider(FSH_MODE, completionProviderInstance)
  );
  commands.registerCommand('extension.openFhir', openFhirDocumentation);
  updateFhirDefinitions(
    completionProviderInstance,
    workspace.getConfiguration('fsh').get<string>('fhirCachePath')
  );
  workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('fsh.fhirCachePath')) {
      updateFhirDefinitions(
        completionProviderInstance,
        workspace.getConfiguration('fsh').get<string>('fhirCachePath')
      );
    }
  });
  return { definitionProviderInstance, completionProviderInstance };
}

export async function updateFhirDefinitions(
  completionProviderInstance: FshCompletionProvider,
  cachePath: string
): Promise<void> {
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
      completionProviderInstance.updateFhirEntities(parsedContents);
    } catch (err) {
      throw new Error("Couldn't read definition information from FHIR package.");
    }
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
