import { assert } from 'chai';
import * as vscode from 'vscode';
import { getTargetName } from '../../utils';

suite('utils', () => {
  suite('#getTargetName', () => {
    test('should get a name with alphanumeric characters', async () => {
      // MyPatient
      // profiles1.fsh, line 5, col 15
      const fileUri = await vscode.workspace.findFiles('profiles/profiles1.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(4, 14);
      const name = getTargetName(document, position);
      assert.strictEqual(name, 'MyPatient');
    });

    test('should get a name that contains a hyphen', async () => {
      // ext-1
      // invariants.fsh, line 7, col 14
      const fileUri = await vscode.workspace.findFiles('invariants.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(6, 13);
      const name = getTargetName(document, position);
      assert.strictEqual(name, 'ext-1');
    });

    test('should get a name that contains an underscore', async () => {
      // Extra_SpecialObservation
      // profiles2.fsh, line 1, col 20
      const fileUri = await vscode.workspace.findFiles('profiles/profiles2.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(0, 19);
      const name = getTargetName(document, position);
      assert.strictEqual(name, 'Extra_SpecialObservation');
    });

    test('should get a name enclosed by parentheses', async () => {
      // MyPatient
      // profiles2.fsh, line 5, col 33
      const fileUri = await vscode.workspace.findFiles('profiles/profiles2.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(4, 32);
      const name = getTargetName(document, position);
      assert.strictEqual(name, 'MyPatient');
    });

    test('should get the name of a system in a concept', async () => {
      // IC
      // valuesets.fsh, line 7, col 12
      const fileUri = await vscode.workspace.findFiles('valuesets.fsh');
      assert.strictEqual(fileUri.length, 1);
      const document = await vscode.workspace.openTextDocument(fileUri[0]);
      const position = new vscode.Position(6, 11);
      const name = getTargetName(document, position);
      assert.strictEqual(name, 'IC');
    });
  });
});
