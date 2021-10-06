import chai from 'chai';
import spies from 'chai-spies';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs-extra';
import * as parser from '../../parser';
import { FshDefinitionProvider, NameInfo } from '../../FshDefinitionProvider';

chai.use(spies);
const { assert, expect } = chai;

suite('FshDefinitionProvider', () => {
  let extension: vscode.Extension<any>;
  let instance: FshDefinitionProvider;

  before(() => {
    extension = vscode.extensions.getExtension('kmahalingam.vscode-language-fsh');
    instance = extension?.exports.definitionProviderInstance as FshDefinitionProvider;
  });

  suite('#constructor', () => {
    after(() => {
      // make sure the files we made are gone
      fs.removeSync(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'constructor-test'));
      // scan all to reset the state of the provider
      instance.scanAll();
    });

    test('should be active and initialized in our workspace', () => {
      assert.exists(instance);
      assert.instanceOf(instance, FshDefinitionProvider);
      const { nameInformation, fileNames, fsWatcher } = instance;
      assert.exists(nameInformation);
      assert.isNotEmpty(nameInformation);
      assert.exists(fileNames);
      assert.isNotEmpty(fileNames);
      assert.exists(fsWatcher);
    });
  });

  suite('#scanAll', () => {
    test('should have an entry in fileNames for each file path', () => {
      assert.equal(instance.fileNames.size, 10);

      assert.containsAllKeys(instance.fileNames, [
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles1.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles2.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'aliases.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'extensions.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'invariants.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'resources.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'logicalModels.fsh')
      ]);
    });

    test('should have all names present in a file stored', () => {
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles1.fsh')
        ),
        ['MyObservation', 'MyPatient', 'ReusedName']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles2.fsh')
        ),
        ['Extra_SpecialObservation']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'aliases.fsh')
        ),
        ['ZOO', 'IC']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh')
        ),
        ['MyCodeSystem', 'AnotherCodeSystem']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'extensions.fsh')
        ),
        ['IceCreamExtension']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'invariants.fsh')
        ),
        ['inv-1', 'inv-2', 'ext-1']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh')
        ),
        ['SimpleRuleSet', 'ParamRuleSet']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh')
        ),
        ['MyValueSet', 'ReusedName']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'logicalModels.fsh')
        ),
        ['Employee-PT', 'Employee']
      );
      assert.sameMembers(
        instance.fileNames.get(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'resources.fsh')
        ),
        ['Laptop']
      );
    });

    test('should have an entry in nameInformation for each name', () => {
      assert.equal(instance.nameInformation.size, 18);
      assert.containsAllKeys(instance.nameInformation, [
        'MyObservation',
        'MyPatient',
        'ReusedName',
        'Extra_SpecialObservation',
        'ZOO',
        'IC',
        'MyCodeSystem',
        'AnotherCodeSystem',
        'IceCreamExtension',
        'inv-1',
        'inv-2',
        'ext-1',
        'SimpleRuleSet',
        'ParamRuleSet',
        'MyValueSet',
        'Employee',
        'Employee-PT',
        'Laptop'
      ]);
    });

    test('should have the information stored for a name with one location', () => {
      const expectedInformation: NameInfo[] = [
        {
          location: new vscode.Location(
            vscode.Uri.file(
              path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh')
            ),
            new vscode.Position(74, 0)
          ),
          type: 'CodeSystem',
          id: 'another-code-system'
        }
      ];
      assert.sameDeepMembers(
        instance.nameInformation.get('AnotherCodeSystem'),
        expectedInformation
      );
    });

    test('should have all information stored for a name with multiple locations', () => {
      const expectedInformation: NameInfo[] = [
        {
          location: new vscode.Location(
            vscode.Uri.file(
              path.join(
                vscode.workspace.workspaceFolders[0].uri.fsPath,
                'profiles',
                'profiles1.fsh'
              )
            ),
            new vscode.Position(9, 0)
          ),
          type: 'Profile',
          id: 'reused-observation'
        },
        {
          location: new vscode.Location(
            vscode.Uri.file(
              path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh')
            ),
            new vscode.Position(9, 0)
          ),
          type: 'ValueSet',
          id: 'reused-values'
        }
      ];
      assert.sameDeepMembers(instance.nameInformation.get('ReusedName'), expectedInformation);
    });
  });

  suite('#updateNamesFromFile', function () {
    beforeEach(() => {
      instance.scanAll();
    });

    afterEach(() => {
      instance.scanAll();
      chai.spy.restore();
    });

    test('should add information from a new file path', () => {
      // clear out all maps to force updates
      instance.fileNames.clear();
      instance.nameInformation.clear();
      instance.latestHashes.clear();
      // update from one file
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      instance.updateNamesFromFile(filePath);
      assert.equal(instance.fileNames.size, 1);
      assert.hasAllKeys(instance.fileNames, [filePath]);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.hasAllKeys(instance.nameInformation, ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameInformation.get('SimpleRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      assert.sameDeepMembers(instance.nameInformation.get('ParamRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
    });

    test('should add information from a new file path', () => {
      // clear out all maps to force updates
      instance.fileNames.clear();
      instance.nameInformation.clear();
      instance.latestHashes.clear();
      // update from one file
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      instance.updateNamesFromFile(vscode.Uri.file(filePath));
      assert.equal(instance.fileNames.size, 1);
      assert.hasAllKeys(instance.fileNames, [filePath]);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.hasAllKeys(instance.nameInformation, ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameInformation.get('SimpleRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      assert.sameDeepMembers(instance.nameInformation.get('ParamRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
    });

    test('should add information from a TextDocument', async () => {
      // clear out all maps to force updates
      instance.fileNames.clear();
      instance.nameInformation.clear();
      instance.latestHashes.clear();
      // update from one TextDocument
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      const doc = await vscode.workspace.openTextDocument(filePath);
      instance.updateNamesFromFile(undefined, doc);
      assert.equal(instance.fileNames.size, 1);
      assert.hasAllKeys(instance.fileNames, [filePath]);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.hasAllKeys(instance.nameInformation, ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameInformation.get('SimpleRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      assert.sameDeepMembers(instance.nameInformation.get('ParamRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
    });

    test('should update information from an existing file path', () => {
      // clear hashes to force file reparse
      instance.latestHashes.clear();
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      // modify both maps
      instance.fileNames.set(filePath, ['ThisGotDeleted', 'SimpleRuleSet', 'ParamRuleSet']);
      instance.nameInformation.set('SimpleRuleSet', [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(5, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      instance.nameInformation.set('ParamRuleSet', [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(10, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      // update from one file
      instance.updateNamesFromFile(filePath);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameInformation.get('SimpleRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      assert.sameDeepMembers(instance.nameInformation.get('ParamRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
    });

    test('should not parse and update information from a file if its hash has not changed', () => {
      const parserSpy = chai.spy.on(parser, 'getTreeForText');
      // this time, specifically do not clear out latestHashes!
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      // modify both maps
      instance.fileNames.set(filePath, ['ThisGotDeleted', 'SimpleRuleSet', 'ParamRuleSet']);
      instance.nameInformation.set('SimpleRuleSet', [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(5, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      instance.nameInformation.set('ParamRuleSet', [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(10, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      // try to update from one file,
      instance.updateNamesFromFile(filePath);
      // but the parser should not have been called, and the maps should not be different.
      expect(parserSpy).to.have.been.called.exactly(0);
      assert.sameMembers(instance.fileNames.get(filePath), [
        'ThisGotDeleted',
        'SimpleRuleSet',
        'ParamRuleSet'
      ]);
      assert.sameDeepMembers(instance.nameInformation.get('SimpleRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(5, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
      assert.sameDeepMembers(instance.nameInformation.get('ParamRuleSet'), [
        {
          location: new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(10, 0)),
          type: 'RuleSet',
          id: undefined
        }
      ]);
    });
  });

  suite('#handleDeletedFile', () => {
    beforeEach(() => {
      instance.scanAll();
    });

    afterEach(() => {
      instance.scanAll();
    });

    test('should remove information for a file path', () => {
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh');
      assert.exists(instance.fileNames.get(filePath));
      assert.lengthOf(instance.nameInformation.get('MyValueSet'), 1);
      assert.lengthOf(instance.nameInformation.get('ReusedName'), 2);
      instance.handleDeletedFile(filePath);
      assert.notExists(instance.fileNames.get(filePath));
      assert.notExists(instance.latestHashes.get(filePath));
      // MyValueSet is only in this file, so it should be removed
      assert.notExists(instance.nameInformation.get('MyValueSet'));
      // ReusedName is in one other file, so that entry should still exist
      assert.lengthOf(instance.nameInformation.get('ReusedName'), 1);
      assert.notEqual(instance.nameInformation.get('ReusedName')[0].location.uri.fsPath, filePath);
    });

    test('should remove information for a file Uri', () => {
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh');
      assert.exists(instance.fileNames.get(filePath));
      assert.lengthOf(instance.nameInformation.get('MyValueSet'), 1);
      assert.lengthOf(instance.nameInformation.get('ReusedName'), 2);
      instance.handleDeletedFile(vscode.Uri.file(filePath));
      assert.notExists(instance.fileNames.get(filePath));
      assert.notExists(instance.latestHashes.get(filePath));
      // MyValueSet is only in this file, so it should be removed
      assert.notExists(instance.nameInformation.get('MyValueSet'));
      // ReusedName is in one other file, so that entry should still exist
      assert.lengthOf(instance.nameInformation.get('ReusedName'), 1);
      assert.notEqual(instance.nameInformation.get('ReusedName')[0].location.uri.fsPath, filePath);
    });
  });

  suite('#handleDirtyFiles', function () {
    afterEach(async () => {
      // restore spies
      chai.spy.restore();
      // close the editors to get rid of unsaved changes
      await vscode.window.showTextDocument(
        vscode.Uri.file(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh')
        )
      );
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await vscode.window.showTextDocument(
        vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'aliases.fsh'))
      );
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('should update information for a modified file', async () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'codesystems.fsh'
      );
      const fileChange = new vscode.WorkspaceEdit();
      fileChange.replace(
        vscode.Uri.file(filePath),
        new vscode.Range(new vscode.Position(0, 12), new vscode.Position(0, 24)),
        'AnimalCodeSystem'
      );
      await vscode.workspace.applyEdit(fileChange);
      instance.handleDirtyFiles();
      assert.notExists(instance.nameInformation.get('MyCodeSystem'));
      assert.exists(instance.nameInformation.get('AnimalCodeSystem'));
    });

    test('should not parse a modified file if its hash has not changed', async () => {
      const updateSpy = chai.spy.on(instance, 'updateNamesFromFile');
      const parserSpy = chai.spy.on(parser, 'getTreeForText');
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'aliases.fsh');
      const fileChange = new vscode.WorkspaceEdit();
      // This replacement operation won't change the actual contents, but will mark the file as having changed
      fileChange.replace(vscode.Uri.file(filePath), new vscode.Range(0, 0, 0, 5), 'Alias');
      await vscode.workspace.applyEdit(fileChange);
      instance.handleDirtyFiles();
      // We should call the update function, but
      expect(updateSpy).to.have.been.called.exactly(1);
      // it should detect that the hash is the same, and not parse the text.
      expect(parserSpy).to.have.been.called.exactly(0);
    });
  });
});
