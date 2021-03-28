import * as assert from 'assert';
import path from 'path';
import nock from 'nock';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

import * as myExtension from '../../extension';
import { Uri } from 'vscode';

suite('Extension Test Suite', () => {
  // The vscode.Position class starts at 0.
  // That is, the first line of a file is line 0, and
  // the first character of a line is character 0.
  suite('#getDefinitionLocation', () => {
    test('should find a Profile definition', () => {
      try {
        const location = myExtension.getDefinitionLocation('MyPatient');
        assert.ok(location);
        const expectedUriPath = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          'profiles1.fsh'
        );
        assert.strictEqual(location.uri.fsPath, expectedUriPath);
        assert.strictEqual(location.range.start.line, 4);
      } catch (err) {
        assert.fail(err);
      }
    });

    test('should find an Extension definition', () => {
      try {
        const location = myExtension.getDefinitionLocation('IceCreamExtension');
        assert.ok(location);
        const expectedUriPath = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          'extensions.fsh'
        );
        assert.strictEqual(location.uri.fsPath, expectedUriPath);
        assert.strictEqual(location.range.start.line, 1);
      } catch (err) {
        assert.fail(err);
      }
    });

    test('should find a ValueSet definition', () => {
      try {
        const location = myExtension.getDefinitionLocation('MyValueSet');
        assert.ok(location);
        const expectedUriPath = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          'valuesets.fsh'
        );
        assert.strictEqual(location.uri.fsPath, expectedUriPath);
        assert.strictEqual(location.range.start.line, 0);
      } catch (err) {
        assert.fail(err);
      }
    });

    test('should find a CodeSystem definition', () => {
      try {
        const location = myExtension.getDefinitionLocation('AnotherCodeSystem');
        assert.ok(location);
        const expectedUriPath = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          'codesystems.fsh'
        );
        assert.strictEqual(location.uri.fsPath, expectedUriPath);
        assert.strictEqual(location.range.start.line, 74);
      } catch (err) {
        assert.fail(err);
      }
    });

    test('should find an Invariant definition', () => {
      try {
        const location = myExtension.getDefinitionLocation('inv-2');
        assert.ok(location);
        const expectedUriPath = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          'invariants.fsh'
        );
        assert.strictEqual(location.uri.fsPath, expectedUriPath);
        assert.strictEqual(location.range.start.line, 3);
      } catch (err) {
        assert.fail(err);
      }
    });

    test('should find an Alias definition', () => {
      try {
        const location = myExtension.getDefinitionLocation('ZOO');
        assert.ok(location);
        const expectedUriPath = path.join(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          'aliases.fsh'
        );
        assert.strictEqual(location.uri.fsPath, expectedUriPath);
        assert.strictEqual(location.range.start.line, 0);
      } catch (err) {
        assert.fail(err);
      }
    });
  });

  suite('#getTargetName', () => {
    test('should get a name with alphanumeric characters', async () => {
      // MyPatient
      // profiles1.fsh, line 5, col 15
      const fileUri = await vscode.workspace.findFiles('profiles1.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(4, 14);
      const name = myExtension.getTargetName(document, position);
      assert.strictEqual(name, 'MyPatient');
    });

    test('should get a name that contains a hyphen', async () => {
      // ext-1
      // invariants.fsh, line 7, col 14
      const fileUri = await vscode.workspace.findFiles('invariants.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(6, 13);
      const name = myExtension.getTargetName(document, position);
      assert.strictEqual(name, 'ext-1');
    });

    test('should get a name that contains an underscore', async () => {
      // Extra_SpecialObservation
      // profiles2.fsh, line 1, col 20
      const fileUri = await vscode.workspace.findFiles('profiles2.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(0, 19);
      const name = myExtension.getTargetName(document, position);
      assert.strictEqual(name, 'Extra_SpecialObservation');
    });

    test('should get a name enclosed by parentheses', async () => {
      // MyPatient
      // profiles2.fsh, line 5, col 33
      const fileUri = await vscode.workspace.findFiles('profiles2.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(4, 32);
      const name = myExtension.getTargetName(document, position);
      assert.strictEqual(name, 'MyPatient');
    });

    test('should get the name of a system in a concept', async () => {
      // IC
      // valuesets.fsh, line 7, col 12
      const fileUri = await vscode.workspace.findFiles('valuesets.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(6, 11);
      const name = myExtension.getTargetName(document, position);
      assert.strictEqual(name, 'IC');
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
      assert.equal(
        myExtension.getDocumentationUri('Profile'),
        myExtension.SPECIAL_URLS.get('profile')
      );
      assert.equal(
        myExtension.getDocumentationUri('CodeSystem'),
        myExtension.SPECIAL_URLS.get('codesystem')
      );
    });

    test('should return a FHIR documentation uri when the input is not a FSH entity name', () => {
      assert.deepEqual(
        myExtension.getDocumentationUri('PractitionerRole'),
        Uri.parse('https://hl7.org/fhir/practitionerrole.html', true)
      );
    });
  });
});
