import chai from 'chai';
import spies from 'chai-spies';
import { before, afterEach } from 'mocha';
import * as vscode from 'vscode';
import path from 'path';
import { EOL } from 'os';
import { FshCompletionProvider } from '../../FshCompletionProvider';

chai.use(spies);
const { assert, expect } = chai;

// Since the tests actually run from the build output directory,
// use this path to help find the FHIR caches we use.
const TEST_ROOT = path.join(__dirname, '..', '..', '..', 'src', 'test');

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

  suite('#getFhirItems', () => {
    before(() => {
      // set up a small set of FHIR items
      const fhirProfiles = [new vscode.CompletionItem('some-profile')];
      const fhirResources = [new vscode.CompletionItem('Patient')];
      const fhirExtensions = [new vscode.CompletionItem('goal-reasonRejected')];
      const fhirCodeSystems = [new vscode.CompletionItem('composition-attestation-mode')];
      const fhirValueSets = [new vscode.CompletionItem('goal-start-event')];
      instance.fhirEntities = {
        'some.package': {
          profiles: fhirProfiles,
          resources: fhirResources,
          extensions: fhirExtensions,
          logicals: [],
          codeSystems: fhirCodeSystems,
          valueSets: fhirValueSets
        }
      };
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
      instance.cachePath = vscode.workspace.getConfiguration('fsh').get<string>('fhirCachePath');
      instance.fhirEntities = {};
      chai.spy.restore();
    });

    test('should update from the default FHIR version when there is no SUSHI config', async () => {
      instance.cachePath = path.join(TEST_ROOT, '.fhir');
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
      instance.cachePath = path.join(TEST_ROOT, '.fhir');
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
      instance.cachePath = path.join(TEST_ROOT, '.fhir');
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
      instance.cachePath = path.join(TEST_ROOT, '.fhir');
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
      instance.cachePath = path.join(TEST_ROOT, '.fhir');
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
    test('should create items based on the files in the specified packages', async () => {
      instance.fhirEntities = {};
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
      instance.cachePath = path.join(TEST_ROOT, '.fhir');
      const items = await instance.makeItemsFromDependencies(dependencies);
      assert.hasAllKeys(items, ['some.other.package#1.0.1', 'hl7.fhir.r4.core#4.0.1']);

      const expectedProfile = new vscode.CompletionItem('MyProfile');
      expectedProfile.detail = 'some.other.package Profile';
      const expectedResource = new vscode.CompletionItem('MyResource');
      expectedResource.detail = 'hl7.fhir.r4.core Resource';
      const expectedExtension = new vscode.CompletionItem('MyExtension');
      expectedExtension.detail = 'some.other.package Extension';
      const expectedLogical = new vscode.CompletionItem('MyLogical');
      expectedLogical.detail = 'some.other.package Logical';
      const expectedCodeSystem = new vscode.CompletionItem('MyCodeSystem');
      expectedCodeSystem.detail = 'hl7.fhir.r4.core CodeSystem';
      const expectedValueSet = new vscode.CompletionItem('my-value-set');
      expectedValueSet.detail = 'hl7.fhir.r4.core ValueSet';
      assert.deepInclude(items['some.other.package#1.0.1'].profiles, expectedProfile);
      assert.deepInclude(items['hl7.fhir.r4.core#4.0.1'].resources, expectedResource);
      assert.deepInclude(items['some.other.package#1.0.1'].extensions, expectedExtension);
      assert.deepInclude(items['some.other.package#1.0.1'].logicals, expectedLogical);
      assert.deepInclude(items['hl7.fhir.r4.core#4.0.1'].codeSystems, expectedCodeSystem);
      assert.deepInclude(items['hl7.fhir.r4.core#4.0.1'].valueSets, expectedValueSet);
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

    test('should identify a FHIR complex type as Resource', () => {
      const fhirJson = {
        resourceType: 'StructureDefinition',
        type: 'MyComplexType',
        kind: 'complex-type',
        derivation: 'specialization',
        name: 'MyComplexType'
      };
      const result = instance.determineEntityType(fhirJson);
      assert.equal(result, 'Resource');
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
