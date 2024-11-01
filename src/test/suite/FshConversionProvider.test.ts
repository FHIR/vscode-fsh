import chai from 'chai';
import spies from 'chai-spies';
import { before, after } from 'mocha';
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs-extra';
import {
  FshConversionProvider,
  createFSHURIfromIdentifier,
  createJSONURIfromIdentifier,
  findNamesInFSHResource,
  findJsonResourcesInResult,
  findConfiguration
} from '../../FshConversionProvider';

chai.use(spies);
const assert: Chai.AssertStatic = chai.assert;

suite('FshConversionProvider', () => {
  let extension: vscode.Extension<any>;
  let instance: FshConversionProvider;

  before(() => {
    extension = vscode.extensions.getExtension('fhir-shorthand.vscode-fsh');
    instance = extension?.exports.conversionProviderInstance as FshConversionProvider;
  });

  suite('#constructor', () => {
    after(() => {
      // make sure the files we made are gone
      fs.removeSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'constructor-test'));
      // scan all to reset the state of the provider
    });

    test('should be active and initialized in our workspace', () => {
      assert.exists(instance);
      assert.instanceOf(instance, FshConversionProvider);
      assert.strictEqual(FshConversionProvider.fshConversionProviderScheme, 'fshfhirconversion');
    });
  });

  suite('#CreateURIFromidentifier', () => {
    test('should create the correct FSH URI', () => {
      const identifier = 'MyPatient';
      const fshURI = createFSHURIfromIdentifier(identifier);

      assert.strictEqual(
        fshURI.toString(true),
        'fshfhirconversion: (PREVIEW) ' + identifier + '.fsh'
      );
    });

    test('should create the correct JSON URI', () => {
      const identifier = 'MyPatient';
      const fshURI = createJSONURIfromIdentifier(identifier);

      assert.strictEqual(
        fshURI.toString(true),
        'fshfhirconversion: (PREVIEW) ' + identifier + '.json'
      );
    });
  });

  suite('#FindResourceNameFromFSHResourceStringContent', () => {
    test('should create the correct FSH Resource name from Codesystem', async () => {
      const fshURI = await vscode.workspace.findFiles('codesystems.fsh');
      const fshName = ['MyCodeSystem', 'AnotherCodeSystem'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });

    test('should create the correct FSH Resource name from Instance', async () => {
      const fshURI = await vscode.workspace.findFiles('instances.fsh');
      const fshName = ['ThisOneObservation'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });

    test('should create the correct FSH Resource name from Valueset', async () => {
      const fshURI = await vscode.workspace.findFiles('valuesets.fsh');
      const fshName = ['MyValueSet', 'ReusedName'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });

    test('should create the correct FSH Resource name from Logical', async () => {
      const fshURI = await vscode.workspace.findFiles('logicalModels.fsh');
      const fshName = ['Employee', 'Employee-PT'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });

    test('should create the correct FSH Resource name from Resource', async () => {
      const fshURI = await vscode.workspace.findFiles('resources.fsh');
      const fshName = ['Laptop'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });

    test('should create the correct FSH Resource name from Profile', async () => {
      const fshURI = await vscode.workspace.findFiles('profiles/profiles1.fsh');
      const fshName = ['MyObservation', 'MyPatient', 'ReusedName'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });

    test('should create the correct FSH Resource name from Extension', async () => {
      const fshURI = await vscode.workspace.findFiles('extensions.fsh');
      const fshName = ['IceCreamExtension'];

      assert.deepStrictEqual(await findNamesInFSHResource(fshURI[0]), fshName);
    });
  });

  suite('FindResourcesInJSONResult', () => {
    const jsonResources: any[] = [];

    before(async () => {
      //Read the files
      const jsonFHIR = await vscode.workspace.findFiles('jsonFHIR/*.json');
      jsonFHIR.forEach(async file => {
        jsonResources.push(JSON.parse(fs.readFileSync(file.fsPath, 'utf8')));
      });
    });

    test('should find the correct JSON Resource by ID', async () => {
      const csURI = await vscode.workspace.findFiles('jsonFHIR/codesystem.json');
      const resourceId = 'my-code-system';

      assert.exists(findJsonResourcesInResult(jsonResources, [resourceId])[0]);
      assert.deepStrictEqual(
        JSON.parse(findJsonResourcesInResult(jsonResources, [resourceId])[0]),
        JSON.parse(fs.readFileSync(csURI[0].fsPath, 'utf8'))
      );
    });

    test('should find the correct JSON Resource by Name', async () => {
      const csURI = await vscode.workspace.findFiles('jsonFHIR/codesystem.json');
      const resourceName = 'MyCodeSystem';

      assert.exists(findJsonResourcesInResult(jsonResources, [resourceName])[0]);
      assert.deepStrictEqual(
        JSON.parse(findJsonResourcesInResult(jsonResources, [resourceName])[0]),
        JSON.parse(fs.readFileSync(csURI[0].fsPath, 'utf8'))
      );
    });
  });

  suite('ReadSushiConfiguration', () => {
    test('ReadSushiConfiguration', async () => {
      const referenceURI = await vscode.workspace.findFiles('sushiProject/reference');
      const sushiConfigUri = await vscode.workspace.findFiles('sushiProject/sushi-config.yaml');

      const sushiConfig = await findConfiguration(referenceURI[0]);

      const expectedDependencies = ['hl7.fhir.us.core@3.1.0', 'hl7.fhir.uv.vhdir@current'];

      assert.strictEqual(
        sushiConfig.canonical,
        'http://hl7.org/fhir/sushi-test',
        'Canonical URL is incorrect'
      );
      assert.deepStrictEqual(
        sushiConfig.dependencies,
        expectedDependencies,
        'Dependencies are incorrect'
      );
      assert.strictEqual(
        sushiConfig.sushiconfig.fsPath,
        sushiConfigUri[0].fsPath,
        'Sushi-config file path is incorrect'
      );
      assert.strictEqual(sushiConfig.version, '4.0.1', 'FHIR Version is incorrect');
    });
  });
});
