import { assert } from 'chai';
import nock from 'nock';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  // Note: The vscode.Position class starts at 0.
  // That is, the first line of a file is line 0, and
  // the first character of a line is character 0.

  suite('#getFhirDocumentationName', function () {
    test('should get a name with alphanumeric characters', async () => {
      // Patient
      // profiles1.fsh, line 6, col 12
      const fileUri = await vscode.workspace.findFiles('profiles/profiles1.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(5, 11);
      const name = myExtension.getFhirDocumentationName(document, position);
      assert.strictEqual(name, 'Patient');
    });

    test('should get the name Extension: when checking the location where a FSH Extension is defined', async () => {
      // Extension:
      // extensions.fsh, line 2, col 6
      const fileUri = await vscode.workspace.findFiles('extensions.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(1, 5);
      const name = myExtension.getFhirDocumentationName(document, position);
      assert.strictEqual(name, 'Extension:');
    });
  });

  suite('#isDocumentationUriValid', function () {
    this.timeout(0);
    setup(() => {
      nock('https://hl7.org').head('/good-uri').reply(200);
      nock('https://hl7.org').head('/bad-uri').reply(404);
      nock('https://hl7.org').head('/slow-uri').delayConnection(20000).reply(200);
    });

    test('should return true when a documentation uri resolves with a success code', async () => {
      assert.strictEqual(
        await myExtension.isDocumentationUriValid('https://hl7.org/good-uri'),
        true
      );
    });

    test('should return false when a documentation uri resolves with a failure code', async () => {
      assert.strictEqual(
        await myExtension.isDocumentationUriValid('https://hl7.org/bad-uri'),
        false
      );
    });

    test('should return false when a documentation uri request takes more than 15 seconds', async () => {
      assert.strictEqual(
        await myExtension.isDocumentationUriValid('https://hl7.org/slow-uri'),
        false
      );
    });
  });

  suite('#getDocumentationUri', () => {
    test('should return the corresponding specific uri when the input is a FSH entity name', () => {
      // FSH documentation URLs are not affected by the project's FHIR version
      assert.equal(
        myExtension.getDocumentationUri('Profile', null),
        myExtension.SPECIAL_URLS.get('profile')
      );
      assert.equal(
        myExtension.getDocumentationUri('CodeSystem', null),
        myExtension.SPECIAL_URLS.get('codesystem')
      );
    });

    test('should return a FHIR documentation uri when the name is not a FSH entity and the FHIR version is not available', () => {
      assert.deepEqual(
        myExtension.getDocumentationUri('PractitionerRole', null),
        vscode.Uri.parse('https://hl7.org/fhir/practitionerrole.html', true)
      );
    });

    test('should return a FHIR documentation uri when the name is not a FSH entity and a supported FHIR version is provided', () => {
      assert.deepEqual(
        myExtension.getDocumentationUri('Observation', '4.1.0'),
        vscode.Uri.parse('https://hl7.org/fhir/2021Mar/observation.html', true)
      );
    });

    test('should return a FHIR documentation uri when the name is not a FSH entity and an unsupported FHIR version is provided', () => {
      assert.deepEqual(
        myExtension.getDocumentationUri('MedicationRequest', '4.6.8'),
        vscode.Uri.parse('https://hl7.org/fhir/medicationrequest.html', true)
      );
    });
  });
});
