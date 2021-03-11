import * as assert from 'assert';
import path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

import * as myExtension from '../../extension';

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
  });
});
