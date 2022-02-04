import chai from 'chai';
import spies from 'chai-spies';
import { before, beforeEach, after, afterEach } from 'mocha';
import * as vscode from 'vscode';
import path from 'path';
import os from 'os';

import {
  FshCompletionProvider,
  EnhancedCompletionItem,
  ElementInfo
} from '../../FshCompletionProvider';
import { FshDefinitionProvider } from '../../FshDefinitionProvider';

chai.use(spies);
const { assert, expect } = chai;
const { EOL } = os;

// Since the tests actually run from the build output directory,
// use this path to help find the FHIR caches we use.
const TEST_ROOT = path.join(__dirname, '..', '..', '..', 'src', 'test');

suite('FshCompletionProvider', () => {
  let extension: vscode.Extension<any>;
  let instance: FshCompletionProvider;
  let definitionInstance: FshDefinitionProvider;

  before(() => {
    extension = vscode.extensions.getExtension('mitre-health.vscode-language-fsh');
    instance = extension?.exports.completionProviderInstance as FshCompletionProvider;
    definitionInstance = extension?.exports.definitionProviderInstance as FshDefinitionProvider;
  });

  suite('#constructor', () => {
    test('should be active in our workspace', () => {
      assert.exists(instance);
      assert.instanceOf(instance, FshCompletionProvider);
    });
  });

  suite('#getAllowedTypesAndExtraNames', () => {
    // for simplicity of cleanup, all test edits happen in codesystems.fsh
    afterEach(async function () {
      // this step can sometimes take awhile, so increase the allowed time to 5 seconds
      this.timeout(5000);
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

    test('should return Profile, Logical, Resource, and Extension as allowed types when completing Parent for a Profile', async () => {
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
      assert.sameMembers(result.allowedTypes, ['Profile', 'Logical', 'Resource', 'Extension']);
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
      assert.lengthOf(items, 6);
      const observationItem = new vscode.CompletionItem('MyObservation');
      observationItem.detail = 'Profile';
      const patientItem = new vscode.CompletionItem('MyPatient');
      patientItem.detail = 'Profile';
      const reusedNameItem = new vscode.CompletionItem('ReusedName');
      reusedNameItem.detail = 'Profile, ValueSet';
      const reusedIdItem = new vscode.CompletionItem('reused-observation');
      reusedIdItem.detail = 'Profile';
      const specialNameItem = new vscode.CompletionItem('Extra_SpecialObservation');
      specialNameItem.detail = 'Profile';
      const specialIdItem = new vscode.CompletionItem('extra-special-observation');
      specialIdItem.detail = 'Profile';
      assert.includeDeepMembers(items, [
        observationItem,
        patientItem,
        reusedNameItem,
        reusedIdItem,
        specialNameItem,
        specialIdItem
      ]);
    });

    test('should return all CompletionItems that match at least one provided type when multiple types are provided', () => {
      const items = instance.getEntityItems(['Profile', 'Logical']);
      assert.lengthOf(items, 8);
      const observationItem = new vscode.CompletionItem('MyObservation');
      observationItem.detail = 'Profile';
      const patientItem = new vscode.CompletionItem('MyPatient');
      patientItem.detail = 'Profile';
      const reusedNameItem = new vscode.CompletionItem('ReusedName');
      reusedNameItem.detail = 'Profile, ValueSet';
      const reusedIdItem = new vscode.CompletionItem('reused-observation');
      reusedIdItem.detail = 'Profile';
      const specialNameItem = new vscode.CompletionItem('Extra_SpecialObservation');
      specialNameItem.detail = 'Profile';
      const specialIdItem = new vscode.CompletionItem('extra-special-observation');
      specialIdItem.detail = 'Profile';
      const employeeItem = new vscode.CompletionItem('Employee');
      employeeItem.detail = 'Logical';
      const ptItem = new vscode.CompletionItem('Employee-PT');
      ptItem.detail = 'Logical';
      assert.includeDeepMembers(items, [
        observationItem,
        patientItem,
        reusedNameItem,
        reusedIdItem,
        specialNameItem,
        specialIdItem,
        employeeItem,
        ptItem
      ]);
    });
  });

  suite('#getFhirItems', () => {
    before(() => {
      // set up a small set of FHIR items
      const fhirProfiles = [new vscode.CompletionItem('some-profile')];
      const fhirResources = [new vscode.CompletionItem('Patient')];
      const fhirExtensions = [new vscode.CompletionItem('goal-reasonRejected')];
      const fhirCodeSystems = [new vscode.CompletionItem('composition-attestation-mode')];
      const fhirValueSets = [new vscode.CompletionItem('goal-start-event')];
      instance.fhirEntities = new Map();
      instance.fhirEntities.set('some.package', {
        profiles: new Map(fhirProfiles.map(item => [item.label, item])),
        resources: new Map(fhirResources.map(item => [item.label, item])),
        extensions: new Map(fhirExtensions.map(item => [item.label, item])),
        logicals: new Map(),
        codeSystems: new Map(fhirCodeSystems.map(item => [item.label, item])),
        valueSets: new Map(fhirValueSets.map(item => [item.label, item]))
      });
    });

    test('should return all CompletionItems that match the provided type when one type is provided', () => {
      const items = instance.getFhirItems(['Extension']);
      assert.lengthOf(items, 1);
      const extensionItem = new vscode.CompletionItem('goal-reasonRejected');
      assert.includeDeepMembers(items, [extensionItem]);
    });

    test('should return all CompletionItems that match at least one provided type when multiple types are provided', () => {
      const items = instance.getFhirItems(['Resource', 'CodeSystem', 'ValueSet']);
      assert.lengthOf(items, 3);
      const resourceItem = new vscode.CompletionItem('Patient');
      const codeSystemItem = new vscode.CompletionItem('composition-attestation-mode');
      const valueSetItem = new vscode.CompletionItem('goal-start-event');
      assert.includeDeepMembers(items, [resourceItem, codeSystemItem, valueSetItem]);
    });
  });

  suite('#getElementPathInformation', () => {
    // for these tests, just use the config-less default FHIR version
    // for simplicity of cleanup, all test edits happen in profiles2.fsh, 5, 35
    afterEach(async () => {
      await vscode.window.showTextDocument(
        vscode.Uri.file(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles2.fsh')
        )
      );
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('should get the parent and no existing path when writing a Profile rule with no existing path parts', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraObservation${EOL}Parent: Observation${EOL}* sta`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(9, 5));
      assert.equal(result.baseDefinition, 'Observation');
      assert.lengthOf(result.existingPath, 0);
    });

    test('should get the parent and path parts when writing a Profile rule with an existing path part', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraPatient${EOL}Parent: Patient${EOL}* contact.`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(9, 10));
      assert.equal(result.baseDefinition, 'Patient');
      assert.lengthOf(result.existingPath, 1);
      assert.deepEqual(result.existingPath, ['contact']);
    });

    test('should get the parent and path parts when writing a Profile rule with existing path parts that include a slice', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraObservation${EOL}Parent: Observation${EOL}* component[ExtraSlice].inte`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(9, 28));
      assert.equal(result.baseDefinition, 'Observation');
      assert.lengthOf(result.existingPath, 1);
      assert.deepEqual(result.existingPath, ['component']);
    });

    test('should get the parent and path parts when writing a Profile rule with multiple existing path parts', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraObservation${EOL}Parent: Observation${EOL}* component[ExtraSlice].referenceRange.`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(9, 39));
      assert.equal(result.baseDefinition, 'Observation');
      assert.lengthOf(result.existingPath, 2);
      assert.deepEqual(result.existingPath, ['component', 'referenceRange']);
    });

    test('should get path parts for choice elements', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraObservation${EOL}Parent: Observation${EOL}* value[x].`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(9, 11));
      assert.equal(result.baseDefinition, 'Observation');
      assert.lengthOf(result.existingPath, 1);
      assert.deepEqual(result.existingPath, ['value[x]']);
    });

    test('should get the default parent for an Extension that does not have a Parent keyword', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Extension: MyNewExtension${EOL}* ex`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(8, 4));
      assert.equal(result.baseDefinition, 'Extension');
      assert.lengthOf(result.existingPath, 0);
    });

    test('should return null when past the point in a rule where a path would appear', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraObservation${EOL}Parent: Observation${EOL}* insert `
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(9, 9));
      assert.isNull(result);
    });

    test('should return null when writing a rule for something other than a Profile or Extension', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Logical: MyLogical${EOL}* f`
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(8, 3));
      assert.isNull(result);
    });

    test.skip('should get the path parts when writing an indented rule', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'profiles',
        'profiles2.fsh'
      );
      const doc = await vscode.workspace.openTextDocument(filePath);
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.insert(
        vscode.Uri.file(filePath),
        new vscode.Position(5, 35),
        `${EOL}${EOL}Profile: ExtraObservation${EOL}Parent: Observation${EOL}* component MS${EOL}  * `
      );
      await vscode.workspace.applyEdit(fileChange);
      definitionInstance.updateNamesFromFile(filePath, doc);
      const result = instance.getElementPathInformation(doc, new vscode.Position(10, 4));
      assert.equal(result.baseDefinition, 'Observation');
      assert.lengthOf(result.existingPath, 1);
      assert.deepEqual(result.existingPath, ['component']);
    });
  });

  suite('#getBaseDefinitionElements', () => {
    before(() => {
      // set up a small set of FHIR entities
      // first, some core entities for the default parents
      const coreDomainResource: EnhancedCompletionItem = new vscode.CompletionItem(
        'DomainResource'
      );
      coreDomainResource.elements = [
        { path: 'id', types: ['http://hl7.org/fhirpath/System.String'], children: [] }
      ];
      const coreBase: EnhancedCompletionItem = new vscode.CompletionItem('Base');
      coreBase.elements = [];
      const coreExtension: EnhancedCompletionItem = new vscode.CompletionItem('Extension');
      coreExtension.elements = [
        { path: 'id', types: ['http://hl7.org/fhirpath/System.String'], children: [] },
        { path: 'extension', types: ['Extension'], children: [] }
      ];
      // then, some of our own custom packages
      const smallProfile: EnhancedCompletionItem = new vscode.CompletionItem('SomeProfile');
      // when storing profiles, we don't store elements, just the baseDefinition,
      // which comes from the structure definition's type field.
      smallProfile.baseDefinition = 'SmallResource';
      const smallResource: EnhancedCompletionItem = new vscode.CompletionItem('SmallResource');
      smallResource.elements = [
        { path: 'height', types: ['Quantity'], children: [] },
        { path: 'width', types: ['Quantity'], children: [] },
        {
          path: 'material',
          types: ['BackboneElement'],
          children: [{ path: 'description', types: ['string'], children: [] }]
        }
      ];
      const largeResource: EnhancedCompletionItem = new vscode.CompletionItem('LargeResource');
      largeResource.elements = [
        {
          path: 'big',
          types: ['BackboneElement'],
          children: [{ path: 'huge', types: ['boolean'], children: [] }]
        }
      ];
      const regularExtension: EnhancedCompletionItem = new vscode.CompletionItem(
        'RegularExtension'
      );
      regularExtension.elements = [
        { path: 'value[x]', types: ['string', 'boolean', 'Quantity'], children: [] },
        { path: 'extension', types: ['Extension'], children: [] }
      ];
      const someLogical: EnhancedCompletionItem = new vscode.CompletionItem('SomeLogical');
      someLogical.elements = [
        { path: 'question', types: ['string'], children: [] },
        { path: 'answer', types: ['string'], children: [] }
      ];
      const someCodeSystem: EnhancedCompletionItem = new vscode.CompletionItem('SomeCS');
      const someValueSet: EnhancedCompletionItem = new vscode.CompletionItem('SomeVS');

      instance.fhirEntities = new Map();
      instance.fhirEntities.set('fake-fhir-core-package', {
        profiles: new Map(),
        resources: new Map([
          [coreDomainResource.label, coreDomainResource],
          [coreBase.label, coreBase]
        ]),
        extensions: new Map([[coreExtension.label, coreExtension]]),
        logicals: new Map(),
        codeSystems: new Map(),
        valueSets: new Map()
      });
      instance.fhirEntities.set('first-package', {
        profiles: new Map([[smallProfile.label, smallProfile]]),
        resources: new Map([
          [smallResource.label, smallResource],
          [largeResource.label, largeResource]
        ]),
        extensions: new Map(),
        logicals: new Map(),
        codeSystems: new Map([[someCodeSystem.label, someCodeSystem]]),
        valueSets: new Map()
      });
      instance.fhirEntities.set('second-package', {
        profiles: new Map(),
        resources: new Map(),
        extensions: new Map([[regularExtension.label, regularExtension]]),
        logicals: new Map([[someLogical.label, someLogical]]),
        codeSystems: new Map(),
        valueSets: new Map([[someValueSet.label, someValueSet]])
      });

      // set up a small set of FSH entities. we don't need locations for these.
      definitionInstance.nameInformation = new Map();
      // MyLargeProfile is a Profile with parent LargeResource
      definitionInstance.nameInformation.set('MyLargeProfile', [
        {
          location: null,
          type: 'Profile',
          id: null,
          parent: 'LargeResource',
          instanceOf: null
        }
      ]);
      // QuizShow is a Logical with parent SomeLogical
      definitionInstance.nameInformation.set('QuizShow', [
        {
          location: null,
          type: 'Logical',
          id: null,
          parent: 'SomeLogical',
          instanceOf: null
        }
      ]);
      // PopQuiz is a Profile with parent QuizShow
      definitionInstance.nameInformation.set('PopQuiz', [
        {
          location: null,
          type: 'Profile',
          id: null,
          parent: 'QuizShow',
          instanceOf: null
        }
      ]);
      // PopQuizForToday is an Instance of PopQuiz
      definitionInstance.nameInformation.set('PopQuizForToday', [
        {
          location: null,
          type: 'Instance',
          id: null,
          parent: null,
          instanceOf: 'PopQuiz'
        }
      ]);
      // UnknownProfile is a Profile with parent SomeNonexistentResource (doesn't exist)
      definitionInstance.nameInformation.set('UnknownProfile', [
        {
          location: null,
          type: 'Profile',
          id: null,
          parent: 'SomeNonexistentResource',
          instanceOf: null
        }
      ]);
      // MysteryEntity is a Profile with parent UnknownProfile
      definitionInstance.nameInformation.set('MysteryEntity', [
        {
          location: null,
          type: 'Profile',
          id: null,
          parent: 'UnknownProfile',
          instanceOf: null
        }
      ]);
      // entities using the default parent
      // MyNewExtension is an Extension with no specified parent
      definitionInstance.nameInformation.set('MyNewExtension', [
        {
          location: null,
          type: 'Extension',
          id: null,
          parent: null,
          instanceOf: null
        }
      ]);
      // MyNewLogical is a Logical with no specified parent
      definitionInstance.nameInformation.set('MyNewLogical', [
        {
          location: null,
          type: 'Logical',
          id: null,
          parent: null,
          instanceOf: null
        }
      ]);
      // MyNewResource is a Resource with no specified parent
      definitionInstance.nameInformation.set('MyNewResource', [
        {
          location: null,
          type: 'Resource',
          id: null,
          parent: null,
          instanceOf: null
        }
      ]);
    });

    after(() => {
      definitionInstance.scanAll();
    });

    test('should get elements for a FHIR profile', () => {
      const elements = instance.getBaseDefinitionElements('SomeProfile');
      // SomeProfile is a profile of SmallResource
      assert.deepEqual(elements, [
        { path: 'height', types: ['Quantity'], children: [] },
        { path: 'width', types: ['Quantity'], children: [] },
        {
          path: 'material',
          types: ['BackboneElement'],
          children: [{ path: 'description', types: ['string'], children: [] }]
        }
      ]);
    });

    test('should get elements for a FHIR resource', () => {
      const elements = instance.getBaseDefinitionElements('LargeResource');
      assert.deepEqual(elements, [
        {
          path: 'big',
          types: ['BackboneElement'],
          children: [{ path: 'huge', types: ['boolean'], children: [] }]
        }
      ]);
    });

    test('should get elements for a FHIR extension', () => {
      const elements = instance.getBaseDefinitionElements('RegularExtension');
      assert.deepEqual(elements, [
        { path: 'value[x]', types: ['string', 'boolean', 'Quantity'], children: [] },
        { path: 'extension', types: ['Extension'], children: [] }
      ]);
    });

    test('should get elements for a FHIR logical model', () => {
      const elements = instance.getBaseDefinitionElements('SomeLogical');
      assert.deepEqual(elements, [
        { path: 'question', types: ['string'], children: [] },
        { path: 'answer', types: ['string'], children: [] }
      ]);
    });

    test('should get null for a FHIR code system', () => {
      const elements = instance.getBaseDefinitionElements('SomeCS');
      assert.isNull(elements);
    });

    test('should get null for a FHIR value set', () => {
      const elements = instance.getBaseDefinitionElements('SomeVS');
      assert.isNull(elements);
    });

    test('should get null when no entity with the name exists', () => {
      const elements = instance.getBaseDefinitionElements('NothingHere');
      assert.isNull(elements);
    });

    test('should get elements for a FSH definition with a FHIR parent', () => {
      const elements = instance.getBaseDefinitionElements('MyLargeProfile');
      // MyLargeProfile's parent is LargeResource
      assert.deepEqual(elements, [
        {
          path: 'big',
          types: ['BackboneElement'],
          children: [{ path: 'huge', types: ['boolean'], children: [] }]
        }
      ]);
    });

    test('should get elements for a FSH definition with a FSH parent and FHIR ancestor', () => {
      const elements = instance.getBaseDefinitionElements('PopQuiz');
      // PopQuiz's parent is QuizShow. QuizShow's parent is SomeLogical
      assert.deepEqual(elements, [
        { path: 'question', types: ['string'], children: [] },
        { path: 'answer', types: ['string'], children: [] }
      ]);
    });

    test('should get elements for a FSH instance definition that is an instance of another FSH definition', () => {
      const elements = instance.getBaseDefinitionElements('PopQuizForToday');
      // PopQuizForToday is an instance of PopQuiz
      assert.deepEqual(elements, [
        { path: 'question', types: ['string'], children: [] },
        { path: 'answer', types: ['string'], children: [] }
      ]);
    });

    test('should get null for a FSH definition with a FSH parent and no ancestor which is a defined FHIR entity', () => {
      const elements = instance.getBaseDefinitionElements('MysteryEntity');
      // MysteryEntity's parent is UnknownProfile. UnknownProfile's parent is SomeNonexistentResource, which doesn't exist
      assert.isNull(elements);
    });

    test('should get elements for FHIR Extension when the named entity is a FSH Extension with no specified parent', () => {
      const elements = instance.getBaseDefinitionElements('MyNewExtension');
      // MyNewExtension has no parent, so it defaults to Extension
      assert.deepEqual(elements, [
        { path: 'id', types: ['http://hl7.org/fhirpath/System.String'], children: [] },
        { path: 'extension', types: ['Extension'], children: [] }
      ]);
    });

    test('should get elements for FHIR DomainResource when the named entity is a FSH Resource with no specified parent', () => {
      const elements = instance.getBaseDefinitionElements('MyNewResource');
      // MyNewResource has no parent, so it defaults to DomainResource
      assert.deepEqual(elements, [
        { path: 'id', types: ['http://hl7.org/fhirpath/System.String'], children: [] }
      ]);
    });

    test('should get elements for FHIR Base when the named entity is a FSH Logical with no specified parent', () => {
      const elements = instance.getBaseDefinitionElements('MyNewLogical');
      // MyNewLogical has no parent, so it defaults to Base
      assert.lengthOf(elements, 0);
    });
  });

  suite('#getPathItems', () => {
    let patientElements: ElementInfo[];

    beforeEach(() => {
      // we'll need a fake definition for Attachment in our FHIR entities
      const attachmentDefinition: EnhancedCompletionItem = new vscode.CompletionItem('Attachment');
      attachmentDefinition.elements = [
        { path: 'contentType', types: ['code'], children: [] },
        { path: 'language', types: ['code'], children: [] },
        { path: 'data', types: ['base64Binary'], children: [] },
        { path: 'url', types: ['url'], children: [] }
      ];
      instance.fhirEntities = new Map();
      instance.fhirEntities.set('fake-fhir-core-package', {
        profiles: new Map(),
        resources: new Map([[attachmentDefinition.label, attachmentDefinition]]),
        extensions: new Map(),
        logicals: new Map(),
        codeSystems: new Map(),
        valueSets: new Map()
      });
      // we'll use a partial list of elements from Patient
      patientElements = [
        {
          path: 'id',
          types: ['http://hl7.org/fhirpath/System.String'],
          children: []
        },
        {
          path: 'name',
          types: ['HumanName'],
          children: [
            {
              path: 'given',
              types: ['string'],
              children: []
            },
            {
              path: 'family',
              types: ['string'],
              children: []
            }
          ]
        },
        {
          path: 'photo',
          types: ['Attachment'],
          children: []
        },
        {
          path: 'contact',
          types: ['BackboneElement'],
          children: [
            {
              path: 'relationship',
              types: ['CodeableConcept'],
              children: []
            },
            {
              path: 'name',
              types: ['HumanName'],
              children: [
                {
                  path: 'given',
                  types: ['string'],
                  children: []
                },
                {
                  path: 'family',
                  types: ['string'],
                  children: []
                }
              ]
            }
          ]
        }
      ];
    });

    test('should get path items that could appear as the first part of the path', () => {
      const result = instance.getPathItems([], patientElements);
      assert.lengthOf(result, 4);
      assert.includeDeepMembers(result, [
        new vscode.CompletionItem('id'),
        new vscode.CompletionItem('name'),
        new vscode.CompletionItem('photo'),
        new vscode.CompletionItem('contact')
      ]);
    });

    test('should get path items that could appear after an existing path segment', () => {
      const result = instance.getPathItems(['contact'], patientElements);
      assert.lengthOf(result, 2);
      assert.includeDeepMembers(result, [
        new vscode.CompletionItem('relationship'),
        new vscode.CompletionItem('name')
      ]);
    });

    test('should get no items when the existing path segments are not present', () => {
      const result = instance.getPathItems(['con'], patientElements);
      assert.lengthOf(result, 0);
    });

    test('should expand types of leaf elements to provide completion items', () => {
      // Patient.photo has no defined child elements in our tree.
      // But, we can find the FHIR definition of its type Attachment and create those child elements.
      assert.lengthOf(patientElements[2].children, 0);
      const result = instance.getPathItems(['photo'], patientElements);
      assert.lengthOf(result, 4);
      assert.includeDeepMembers(result, [
        new vscode.CompletionItem('contentType'),
        new vscode.CompletionItem('language'),
        new vscode.CompletionItem('data'),
        new vscode.CompletionItem('url')
      ]);
      assert.lengthOf(patientElements[2].children, 4);
    });
  });

  suite('#updateFhirEntities', () => {
    const defaultConfig = [
      'id: cookie.mountain',
      'FSHOnly: false',
      'name: HL7FHIRImplementationGuideCookieMountain',
      'fhirVersion: 4.0.1',
      'copyrightYear: 2020+',
      'releaseLabel: CI Build',
      ''
    ].join(EOL);

    afterEach(async () => {
      // delete the sushi config file, if we made one
      const configFiles = await vscode.workspace.findFiles('sushi-config.{yaml,yml}');
      for (const configFile of configFiles) {
        await vscode.workspace.fs.delete(configFile);
      }
      instance.cachePath = path.join(os.homedir(), '.fhir', 'packages');
      instance.fhirEntities = new Map();
      chai.spy.restore();
    });

    test('should update from the default FHIR version when there is no SUSHI config', async () => {
      instance.cachePath = path.join(TEST_ROOT, '.fhir', 'packages');
      await instance.updateFhirEntities();
      assert.hasAllKeys(instance.fhirEntities, ['hl7.fhir.r4.core#4.0.1']);
    });

    test('should update from the specified version of hl7.fhir.r4b.core when there is a SUSHI config', async () => {
      // create sushi-config.yaml with fhirVersion: 4.3.0
      const configContents = defaultConfig.replace('4.0.1', '4.3.0');
      const configPath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'sushi-config.yaml'
      );
      await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), Buffer.from(configContents));
      // update entities using specified version
      instance.cachePath = path.join(TEST_ROOT, '.fhir', 'packages');
      await instance.updateFhirEntities();
      assert.hasAllKeys(instance.fhirEntities, ['hl7.fhir.r4b.core#4.3.0']);
    });

    test('should update from the specified version of hl7.fhir.r5.core when there is a SUSHI config', async () => {
      // create sushi-config.yml with fhirVersion: 4.8.2
      const configContents = defaultConfig.replace('4.0.1', '4.8.2');
      const configPath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'sushi-config.yml'
      );
      await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), Buffer.from(configContents));
      // update entities using specified version
      instance.cachePath = path.join(TEST_ROOT, '.fhir', 'packages');
      await instance.updateFhirEntities();
      assert.hasAllKeys(instance.fhirEntities, ['hl7.fhir.r5.core#4.8.2']);
    });

    test('should show an information message when a SUSHI config exists, but specifies a FHIR version not present in the cache', async () => {
      // create sushi-config.yml with fhirVersion: 4.7.3
      const configContents = defaultConfig.replace('4.0.1', '4.7.3');
      const configPath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'sushi-config.yml'
      );
      await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), Buffer.from(configContents));
      // update entities using specified version
      const messageSpy = chai.spy.on(vscode.window, 'showInformationMessage');
      instance.cachePath = path.join(TEST_ROOT, '.fhir', 'packages');
      await instance.updateFhirEntities();
      assert.lengthOf(Object.keys(instance.fhirEntities), 0);
      expect(messageSpy).to.have.been.called.with(
        'Could not load definition information for package hl7.fhir.r5.core#4.7.3'
      );
    });

    test('should update from each specified dependency that is present in the cache', async () => {
      // create sushi-config.yml with dependencies:
      //   another.good.package: current
      //   some.other.package:
      //     id: cookies
      //     version: 1.0.1
      // not.this.one#2.0.5
      const configContents =
        defaultConfig +
        [
          'dependencies:',
          '  another.good.package: current',
          '  some.other.package:',
          '    id: cookies',
          '    version: 1.0.1',
          '  not.this.one: 2.0.5'
        ].join(EOL);
      const configPath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'sushi-config.yml'
      );
      await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), Buffer.from(configContents));
      // update entities using specified version
      const messageSpy = chai.spy.on(vscode.window, 'showInformationMessage');
      instance.cachePath = path.join(TEST_ROOT, '.fhir', 'packages');
      await instance.updateFhirEntities();
      assert.hasAllKeys(instance.fhirEntities, [
        'hl7.fhir.r4.core#4.0.1',
        'another.good.package#current',
        'some.other.package#1.0.1'
      ]);
      expect(messageSpy).to.have.been.called.with(
        'Could not load definition information for package not.this.one#2.0.5'
      );
    });

    test('should not update anything when the cache path is null', async () => {
      instance.cachePath = null;
      const previousEntities = instance.fhirEntities;
      await instance.updateFhirEntities();
      assert.equal(previousEntities, instance.fhirEntities);
    });

    test('should throw an error when the cache path does not exist', async () => {
      try {
        instance.cachePath = path.join(__dirname, 'nonsense', 'path');
        await instance.updateFhirEntities();
        assert.fail('updateFhirEntities should have thrown an error.');
      } catch (err) {
        assert.match(err, /Couldn't load FHIR definitions from path/);
      }
    });
  });

  suite('#makeItemsFromDependencies', () => {
    beforeEach(() => {
      instance.fhirEntities = new Map();
      instance.cachedFhirEntities = new Map();
    });

    afterEach(() => {
      chai.spy.restore();
    });

    test('should create items and add them to the cache based on the files in the specified packages', async () => {
      const dependencies = [
        {
          packageId: 'some.other.package',
          version: '1.0.1'
        },
        {
          packageId: 'hl7.fhir.r4.core',
          version: '4.0.1'
        }
      ];
      instance.cachePath = path.join(TEST_ROOT, '.fhir', 'packages');
      const items = await instance.makeItemsFromDependencies(dependencies);
      assert.hasAllKeys(items, ['some.other.package#1.0.1', 'hl7.fhir.r4.core#4.0.1']);

      // the completion item for a profile should come with a baseDefinition
      const expectedProfile: EnhancedCompletionItem = new vscode.CompletionItem('MyProfile');
      expectedProfile.detail = 'some.other.package Profile';
      expectedProfile.baseDefinition = 'MyResource';
      const expectedResource = new vscode.CompletionItem('MyResource');
      expectedResource.detail = 'hl7.fhir.r4.core Resource';
      const expectedExtension = new vscode.CompletionItem('MyExtension');
      expectedExtension.detail = 'some.other.package Extension';
      const expectedLogical = new vscode.CompletionItem('MyLogical');
      expectedLogical.detail = 'some.other.package Logical';
      const expectedNameCodeSystem = new vscode.CompletionItem('MyCodeSystem');
      expectedNameCodeSystem.detail = 'hl7.fhir.r4.core CodeSystem';
      const expectedIdCodeSystem = new vscode.CompletionItem('my-code-system');
      expectedIdCodeSystem.detail = 'hl7.fhir.r4.core CodeSystem';
      const expectedValueSet = new vscode.CompletionItem('my-value-set');
      expectedValueSet.detail = 'hl7.fhir.r4.core ValueSet';

      assert.equal(items.get('some.other.package#1.0.1').profiles.size, 1);
      assert.deepInclude(items.get('some.other.package#1.0.1').profiles, expectedProfile);
      assert.equal(items.get('hl7.fhir.r4.core#4.0.1').resources.size, 1);
      assert.deepInclude(items.get('hl7.fhir.r4.core#4.0.1').resources, expectedResource);
      assert.equal(items.get('some.other.package#1.0.1').extensions.size, 1);
      assert.deepInclude(items.get('some.other.package#1.0.1').extensions, expectedExtension);
      assert.equal(items.get('some.other.package#1.0.1').logicals.size, 1);
      assert.deepInclude(items.get('some.other.package#1.0.1').logicals, expectedLogical);
      assert.equal(items.get('hl7.fhir.r4.core#4.0.1').codeSystems.size, 2);
      assert.deepInclude(items.get('hl7.fhir.r4.core#4.0.1').codeSystems, expectedNameCodeSystem);
      assert.deepInclude(items.get('hl7.fhir.r4.core#4.0.1').codeSystems, expectedIdCodeSystem);
      assert.equal(items.get('hl7.fhir.r4.core#4.0.1').valueSets.size, 1);
      assert.deepInclude(items.get('hl7.fhir.r4.core#4.0.1').valueSets, expectedValueSet);

      assert.equal(instance.cachedFhirEntities.get('some.other.package#1.0.1').profiles.size, 1);
      assert.deepInclude(
        instance.cachedFhirEntities.get('some.other.package#1.0.1').profiles,
        expectedProfile
      );
      assert.equal(instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').resources.size, 1);
      assert.deepInclude(
        instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').resources,
        expectedResource
      );
      assert.equal(instance.cachedFhirEntities.get('some.other.package#1.0.1').extensions.size, 1);
      assert.deepInclude(
        instance.cachedFhirEntities.get('some.other.package#1.0.1').extensions,
        expectedExtension
      );
      assert.equal(instance.cachedFhirEntities.get('some.other.package#1.0.1').logicals.size, 1);
      assert.deepInclude(
        instance.cachedFhirEntities.get('some.other.package#1.0.1').logicals,
        expectedLogical
      );
      assert.equal(instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').codeSystems.size, 2);
      assert.deepInclude(
        instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').codeSystems,
        expectedNameCodeSystem
      );
      assert.deepInclude(
        instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').codeSystems,
        expectedIdCodeSystem
      );
      assert.equal(instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').valueSets.size, 1);
      assert.deepInclude(
        instance.cachedFhirEntities.get('hl7.fhir.r4.core#4.0.1').valueSets,
        expectedValueSet
      );
    });

    test('should use items from the cache when possible', async () => {
      const readFileSpy = chai.spy.on(vscode.workspace.fs, 'readFile');
      const dependencies = [
        {
          packageId: 'very.good.package',
          version: '1.0.1'
        }
      ];
      instance.cachedFhirEntities.set('very.good.package#1.0.1', {
        profiles: new Map([['SomeProfile', new vscode.CompletionItem('SomeProfile')]]),
        resources: new Map(),
        extensions: new Map(),
        logicals: new Map([
          ['LogicalOne', new vscode.CompletionItem('LogicalOne')],
          ['LogicalTwo', new vscode.CompletionItem('LogicalTwo')],
          ['LogicalThree', new vscode.CompletionItem('LogicalThree')]
        ]),
        codeSystems: new Map(),
        valueSets: new Map()
      });
      const items = await instance.makeItemsFromDependencies(dependencies);
      assert.hasAllKeys(items, ['very.good.package#1.0.1']);
      assert.equal(items.get('very.good.package#1.0.1').profiles.size, 1);
      assert.equal(items.get('very.good.package#1.0.1').resources.size, 0);
      assert.equal(items.get('very.good.package#1.0.1').extensions.size, 0);
      assert.equal(items.get('very.good.package#1.0.1').logicals.size, 3);
      assert.equal(items.get('very.good.package#1.0.1').codeSystems.size, 0);
      assert.equal(items.get('very.good.package#1.0.1').valueSets.size, 0);
      // since we got these items from the cache, we shouldn't have read any files
      expect(readFileSpy).to.have.been.called.exactly(0);
    });
  });

  suite('#buildElementsFromSnapshot', () => {
    test('should build elements from a simple snapshot', () => {
      const snapshot: any[] = [
        {
          path: 'Observation'
        },
        {
          path: 'Observation.id',
          type: [
            {
              code: 'http://hl7.org/fhirpath/System.String',
              extension: [
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type',
                  valueUri: 'id'
                }
              ]
            }
          ]
        },
        {
          path: 'Observation.identifier',
          type: [
            {
              code: 'Identifier'
            }
          ]
        },
        {
          path: 'Observation.basedOn',
          type: [
            {
              code: 'Reference',
              targetProfile: [
                'http://hl7.org/fhir/StructureDefinition/CarePlan',
                'http://hl7.org/fhir/StructureDefinition/DeviceRequest',
                'http://hl7.org/fhir/StructureDefinition/ImmunizationRecommendation',
                'http://hl7.org/fhir/StructureDefinition/MedicationRequest',
                'http://hl7.org/fhir/StructureDefinition/NutritionOrder',
                'http://hl7.org/fhir/StructureDefinition/ServiceRequest'
              ]
            }
          ]
        }
      ];
      const elements = instance.buildElementsFromSnapshot(snapshot);
      assert.lengthOf(elements, 3);
      // result elements should be in the same order as the the snapshot
      const expectedElements: ElementInfo[] = [
        {
          path: 'id',
          types: ['http://hl7.org/fhirpath/System.String'],
          children: []
        },
        {
          path: 'identifier',
          types: ['Identifier'],
          children: []
        },
        {
          path: 'basedOn',
          types: ['Reference'],
          children: []
        }
      ];
      assert.deepEqual(elements, expectedElements);
    });

    test('should build elements from a snapshot with multiple levels of elements', () => {
      const snapshot: any[] = [
        {
          path: 'Observation'
        },
        {
          path: 'Observation.referenceRange',
          type: [
            {
              code: 'BackboneElement'
            }
          ]
        },
        {
          path: 'Observation.referenceRange.extension',
          type: [
            {
              code: 'Extension'
            }
          ]
        },
        {
          path: 'Observation.referenceRange.low',
          type: [
            {
              code: 'Quantity',
              profile: ['http://hl7.org/fhir/StructureDefinition/SimpleQuantity']
            }
          ]
        },
        {
          path: 'Observation.referenceRange.high',
          type: [
            {
              code: 'Quantity',
              profile: ['http://hl7.org/fhir/StructureDefinition/SimpleQuantity']
            }
          ]
        },
        {
          path: 'Observation.hasMember',
          type: [
            {
              code: 'Reference',
              targetProfile: [
                'http://hl7.org/fhir/StructureDefinition/Observation',
                'http://hl7.org/fhir/StructureDefinition/QuestionnaireResponse',
                'http://hl7.org/fhir/StructureDefinition/MolecularSequence'
              ]
            }
          ]
        }
      ];
      const elements = instance.buildElementsFromSnapshot(snapshot);
      assert.lengthOf(elements, 2);
      const expectedElements: ElementInfo[] = [
        {
          path: 'referenceRange',
          types: ['BackboneElement'],
          children: [
            {
              path: 'extension',
              types: ['Extension'],
              children: []
            },
            {
              path: 'low',
              types: ['Quantity'],
              children: []
            },
            {
              path: 'high',
              types: ['Quantity'],
              children: []
            }
          ]
        },
        {
          path: 'hasMember',
          types: ['Reference'],
          children: []
        }
      ];
      assert.deepEqual(elements, expectedElements);
    });

    test('should only include an element once when that element has defined slices', () => {
      // a slice will have the same path but a different id
      const snapshot: any[] = [
        {
          path: 'Observation'
        },
        {
          path: 'Observation.component',
          id: 'Observation.component',
          type: [
            {
              code: 'BackboneElement'
            }
          ]
        },
        {
          path: 'Observation.component.code',
          id: 'Observation.component.code',
          type: [
            {
              code: 'CodeableConcept'
            }
          ]
        },
        {
          path: 'Observation.component',
          id: 'Observation.component:systolic',
          type: [
            {
              code: 'BackboneElement'
            }
          ]
        },
        {
          path: 'Observation.component',
          id: 'Observation.component:diastolic',
          type: [
            {
              code: 'BackboneElement'
            }
          ]
        }
      ];
      const elements = instance.buildElementsFromSnapshot(snapshot);
      assert.lengthOf(elements, 1);
      const expectedElements: ElementInfo[] = [
        {
          path: 'component',
          types: ['BackboneElement'],
          children: [
            {
              path: 'code',
              types: ['CodeableConcept'],
              children: []
            }
          ]
        }
      ];
      assert.deepEqual(elements, expectedElements);
    });

    test('should build elements from a snapshot with choice elements', () => {
      const snapshot: any[] = [
        {
          path: 'Observation'
        },
        {
          path: 'Observation.value[x]',
          type: [
            { code: 'Quantity' },
            { code: 'CodeableConcept' },
            { code: 'string' },
            { code: 'boolean' },
            { code: 'integer' },
            { code: 'Range' },
            { code: 'Ratio' },
            { code: 'SampledData' },
            { code: 'time' },
            { code: 'dateTime' },
            { code: 'Period' },
            { code: 'Attachment' }
          ]
        }
      ];
      const elements = instance.buildElementsFromSnapshot(snapshot);
      assert.lengthOf(elements, 13);
      const expectedElements: ElementInfo[] = [
        {
          path: 'value[x]',
          types: [
            'Quantity',
            'CodeableConcept',
            'string',
            'boolean',
            'integer',
            'Range',
            'Ratio',
            'SampledData',
            'time',
            'dateTime',
            'Period',
            'Attachment'
          ],
          children: []
        },
        {
          path: 'valueQuantity',
          types: ['Quantity'],
          children: []
        },
        {
          path: 'valueCodeableConcept',
          types: ['CodeableConcept'],
          children: []
        },
        {
          path: 'valueString',
          types: ['string'],
          children: []
        },
        {
          path: 'valueBoolean',
          types: ['boolean'],
          children: []
        },
        {
          path: 'valueInteger',
          types: ['integer'],
          children: []
        },
        {
          path: 'valueRange',
          types: ['Range'],
          children: []
        },
        {
          path: 'valueRatio',
          types: ['Ratio'],
          children: []
        },
        {
          path: 'valueSampledData',
          types: ['SampledData'],
          children: []
        },
        {
          path: 'valueTime',
          types: ['time'],
          children: []
        },
        {
          path: 'valueDateTime',
          types: ['dateTime'],
          children: []
        },
        {
          path: 'valuePeriod',
          types: ['Period'],
          children: []
        },
        {
          path: 'valueAttachment',
          types: ['Attachment'],
          children: []
        }
      ];
      assert.deepEqual(elements, expectedElements);
    });

    test('should return an empty list if none of the snapshot elements have paths', () => {
      // this should never happen unless the input is very unusual
      const snapshot: any[] = [{ id: 'Unusual' }, { id: 'Unusual.element' }];
      const elements = instance.buildElementsFromSnapshot(snapshot);
      assert.lengthOf(elements, 0);
    });
  });

  suite('#determineEntityType', () => {
    test('should identify a profile of a resource as a Profile', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        type: 'MyResource',
        kind: 'resource',
        derivation: 'constraint',
        name: 'MyProfile'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Profile');
    });

    test('should identify a profile of a logical as a Profile', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        type: 'MyLogical',
        kind: 'logical',
        derivation: 'constraint',
        name: 'MyProfile'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Profile');
    });

    test('should identify a Resource', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        type: 'MyResource',
        kind: 'resource',
        derivation: 'specialization',
        name: 'MyResource'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Resource');
    });

    test('should identify a Type', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        type: 'MyComplexType',
        kind: 'complex-type',
        derivation: 'specialization',
        name: 'MyComplexType'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Type');
    });

    test('should identify an Extension', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        type: 'Extension',
        kind: 'complex-type',
        name: 'MyExtension'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Extension');
    });

    test('should identify a Logical', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        kind: 'logical',
        derivation: 'specialization',
        name: 'MyLogical'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Logical');
    });

    test('should identify a CodeSystem', () => {
      const fhirJson = {
        resourceType: 'CodeSystem',
        name: 'MyCodeSystem'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'CodeSystem');
    });

    test('should identify a ValueSet', () => {
      const fhirJson = {
        resourceType: 'ValueSet',
        name: 'MyValueSet'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'ValueSet');
    });

    test('should return null when the entity is not one of the applicable entity types', () => {
      // for example, a SearchParameter is not one of the applicable entity types.
      const fhirJson = {
        resourceType: 'SearchParameter',
        name: 'MySearchParameter',
        type: 'reference'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.isNull(result);
    });
  });
});
