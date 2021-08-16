import chai from 'chai';
import { before, afterEach } from 'mocha';
import * as vscode from 'vscode';
import path from 'path';
import { EOL } from 'os';
import { FshCompletionProvider } from '../../FshCompletionProvider';

const { assert } = chai;

suite('FshCompletionProvider', () => {
  let extension: vscode.Extension<any>;
  let instance: FshCompletionProvider;

  before(() => {
    extension = vscode.extensions.getExtension('kmahalingam.vscode-language-fsh');
    instance = extension?.exports.completionProviderInstance as FshCompletionProvider;
  });

  suite('#constructor', () => {
    test('should be active in our workspace', () => {
      assert.exists(instance);
      assert.instanceOf(instance, FshCompletionProvider);
    });
  });

  suite('#getAllowedTypesAndExtraNames', () => {
    // for simplicity of cleanup, all test edits happen in codesystems.fsh
    afterEach(async () => {
      await vscode.window.showTextDocument(
        vscode.Uri.file(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh')
        )
      );
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('should return Profile, Resource, and Extension as allowed types when completing after InstanceOf', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Instance: NonsenseInstance${EOL}InstanceOf: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 12));
      assert.sameMembers(result.allowedTypes, ['Profile', 'Resource', 'Extension']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Invariant as the allowed type when completing an obeys rule with a path', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Profile: NonsenseObservation${EOL}Parent: Observation${EOL}* identifier obeys `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(82, 19));
      assert.sameMembers(result.allowedTypes, ['Invariant']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Invariant as the allowed type when completing an obeys rule with no path', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Profile: NonsenseObservation${EOL}Parent: Observation${EOL}* obeys `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(82, 8));
      assert.sameMembers(result.allowedTypes, ['Invariant']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Invariant as the allowed type when completing an obeys rule with a path and multiple invariants', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Profile: NonsenseObservation${EOL}Parent: Observation${EOL}* identifier obeys abc-1, `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(82, 26));
      assert.sameMembers(result.allowedTypes, ['Invariant']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Invariant as the allowed type when completing an obeys rule with no path and multiple invariants', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Profile: NonsenseObservation${EOL}Parent: Observation${EOL}* obeys xyz-2, `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(82, 15));
      assert.sameMembers(result.allowedTypes, ['Invariant']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Profile and Logical as allowed types when completing Parent for a Profile', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Profile: NonsenseProfile${EOL}Parent: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 8));
      assert.sameMembers(result.allowedTypes, ['Profile', 'Logical']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Extension as the allowed type when completing Parent for an Extension', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Extension: NonsenseExtension${EOL}Parent: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 8));
      assert.sameMembers(result.allowedTypes, ['Extension']);
      assert.lengthOf(result.extraNames, 0);
    });

    test('should return Logical and Resource as allowed types and "Base" and "Element" as extra names when completing Parent for a Logical', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Logical: NonsenseLogical${EOL}Parent: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 8));
      assert.sameMembers(result.allowedTypes, ['Logical', 'Resource']);
      assert.sameDeepMembers(result.extraNames, [
        new vscode.CompletionItem('Base'),
        new vscode.CompletionItem('Element')
      ]);
    });

    test('should return no types and "Resource" and "DomainResource" as extra names when completing Parent for a Resource', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Resource: NonsenseResource${EOL}Parent: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 8));
      assert.lengthOf(result.allowedTypes, 0);
      assert.sameDeepMembers(result.extraNames, [
        new vscode.CompletionItem('Resource'),
        new vscode.CompletionItem('DomainResource')
      ]);
    });

    test('should return null when the current line starts with unsupported completion context', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}Profile: NonsenseProfile${EOL}Title: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 7));
      assert.isNull(result);
    });

    test('should return null when completing Parent, but not for one of the supported entity types', async () => {
      // This case represents invalid FSH, such as:
      // CodeSystem: MySystem
      // Parent:
      // The FSH entities that can have a Parent are all supported.
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(78, 25),
        `${EOL}${EOL}CodeSystem: NonsenseCodes${EOL}Parent: `
      );
      await vscode.workspace.applyEdit(fileChange);
      const result = instance.getAllowedTypesAndExtraNames(doc, new vscode.Position(81, 8));
      assert.isNull(result);
    });
  });

  suite('#getEntityItems', () => {
    test('should return all CompletionItems that match the provided type when one type is provided', () => {
      const items = instance.getEntityItems(['Profile']);
      assert.lengthOf(items, 4);
      const observationItem = new vscode.CompletionItem('MyObservation');
      observationItem.detail = 'Profile';
      const patientItem = new vscode.CompletionItem('MyPatient');
      patientItem.detail = 'Profile';
      const reusedItem = new vscode.CompletionItem('ReusedName');
      reusedItem.detail = 'Profile, ValueSet';
      const specialItem = new vscode.CompletionItem('Extra_SpecialObservation');
      specialItem.detail = 'Profile';
      assert.includeDeepMembers(items, [observationItem, patientItem, reusedItem, specialItem]);
    });

    test('should return all CompletionItems that match at least one provided type when multiple types are provided', () => {
      const items = instance.getEntityItems(['Profile', 'Logical']);
      assert.lengthOf(items, 6);
      const observationItem = new vscode.CompletionItem('MyObservation');
      observationItem.detail = 'Profile';
      const patientItem = new vscode.CompletionItem('MyPatient');
      patientItem.detail = 'Profile';
      const reusedItem = new vscode.CompletionItem('ReusedName');
      reusedItem.detail = 'Profile, ValueSet';
      const specialItem = new vscode.CompletionItem('Extra_SpecialObservation');
      specialItem.detail = 'Profile';
      const employeeItem = new vscode.CompletionItem('Employee');
      employeeItem.detail = 'Logical';
      const ptItem = new vscode.CompletionItem('Employee-PT');
      ptItem.detail = 'Logical';
      assert.includeDeepMembers(items, [
        observationItem,
        patientItem,
        reusedItem,
        specialItem,
        employeeItem,
        ptItem
      ]);
    });
  });
});
