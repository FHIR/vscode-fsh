import {
  languages,
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

export function activate(context: ExtensionContext): FshDefinitionProvider {
  const definitionProviderInstance = new FshDefinitionProvider();
  context.subscriptions.push(
    languages.registerDefinitionProvider(FSH_MODE, definitionProviderInstance)
  );
  commands.registerCommand('extension.openFhir', openFhirDocumentation);
  return definitionProviderInstance;
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
