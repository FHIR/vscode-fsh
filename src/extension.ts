import {
  languages,
  tasks,
  commands,
  window,
  ExtensionContext,
  DocumentFilter,
  TextDocument,
  Position,
  env,
  Uri
} from 'vscode';

import axios from 'axios';
import { FshDefinitionProvider } from './FshDefinitionProvider';
import { FshCompletionProvider } from './FshCompletionProvider';
import { SushiBuildTaskProvider } from './SushiBuildTaskProvider';

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

// Documentation URLs are based on the FHIR version supplied in the project configuration.
// http://hl7.org/fhir/directory.html provides the list of FHIR versions with available documentation.
// SUSHI only supports versions 4.0.1 and later, so only those are supported here.
// A user might leave out the -snapshot1 portion of versions, but in those cases,
// the snapshot documentation is probably still useful.
export const DOCUMENTATION_VERSION_PATHS = new Map<string, string>([
  ['4.0.1', '/R4'],
  ['4.1.0', '/2021Mar'],
  ['4.3.0-snapshot1', '/4.3.0-snapshot1'],
  ['4.3.0', '/4.3.0-snapshot1'],
  ['4.2.0', '/2020Feb'],
  ['4.4.0', '/2020May'],
  ['4.5.0', '/2020Sep'],
  ['4.6.0', '/2021May'],
  ['5.0.0-snapshot1', '/5.0.0-snapshot1'],
  ['5.0.0', '/5.0.0-snapshot1']
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
    languages.registerCompletionItemProvider(FSH_MODE, completionProviderInstance, '.')
  );
  commands.registerCommand('extension.openFhir', () =>
    openFhirDocumentation(completionProviderInstance)
  );
  completionProviderInstance.updateFhirEntities();
  tasks.registerTaskProvider('fsh', new SushiBuildTaskProvider());
  return { definitionProviderInstance, completionProviderInstance };
}

export async function openFhirDocumentation(
  completionProviderInstance: FshCompletionProvider
): Promise<void> {
  const document = window.activeTextEditor.document;
  const startPosition = window.activeTextEditor.selection.start;
  if (document && startPosition) {
    const name = getFhirDocumentationName(document, startPosition);
    const uriToOpen = getDocumentationUri(name, completionProviderInstance.fhirVersion);
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

export function getDocumentationUri(name: string, version: string): Uri {
  const versionPath = DOCUMENTATION_VERSION_PATHS.has(version)
    ? DOCUMENTATION_VERSION_PATHS.get(version)
    : '';
  const lowerName = name.toLowerCase();
  if (lowerName === 'extension') {
    return Uri.parse(`https://hl7.org/fhir${versionPath}/extensibility.html`, true);
  } else if (SPECIAL_URLS.has(lowerName)) {
    return SPECIAL_URLS.get(lowerName);
  } else {
    return Uri.parse(`https://hl7.org/fhir${versionPath}/${lowerName}.html`, true);
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
