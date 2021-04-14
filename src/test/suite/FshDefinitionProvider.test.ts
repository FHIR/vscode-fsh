import chai from 'chai';
import spies from 'chai-spies';
import { before, after, beforeEach, afterEach } from 'mocha';
import * as vscode from 'vscode';
import path from 'path';
import fs from 'fs-extra';
import { FshDefinitionProvider } from '../../FshDefinitionProvider';

chai.use(spies);
const { assert, expect } = chai;

suite('FshDefinitionProvider', () => {
  let extension: vscode.Extension<any>;
  let instance: FshDefinitionProvider;

  before(() => {
    extension = vscode.extensions.getExtension('kmahalingam.vscode-language-fsh');
    instance = extension?.exports as FshDefinitionProvider;
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
      const { nameLocations, fileNames, fsWatcher } = instance;
      assert.exists(nameLocations);
      assert.isNotEmpty(nameLocations);
      assert.exists(fileNames);
      assert.isNotEmpty(fileNames);
      assert.exists(fsWatcher);
    });

    // The fsHandler tests use expect in order to play nicely with chai-spy
    test.skip('should call the update handler when a fsh file is created', () => {
      const updateSpy = chai.spy.on(instance, 'updateNamesFromFile');
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'constructor-test',
        'create-test.fsh'
      );
      instance.fsWatcher.onDidCreate.call(instance, vscode.Uri.file(filePath));
      // fs.ensureFileSync(filePath);
      expect(updateSpy).to.have.been.called.once;
      expect(updateSpy).to.have.been.called.with(vscode.Uri.file(filePath));
    });

    test.skip('should call the update handler when a fsh file is updated', () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'constructor-test',
        'change-test.fsh'
      );
      fs.ensureFileSync(filePath);
      // start spying after we know the file exists
      const updateSpy = chai.spy.on(instance, 'updateNamesFromFile');
      fs.writeFileSync(filePath, '// This is just a comment');
      expect(updateSpy).to.have.been.called.once;
      expect(updateSpy).to.have.been.called.with(vscode.Uri.file(filePath));
    });

    test.skip('should call the delete handler when a fsh file is deleted', () => {
      const filePath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'constructor-test',
        'delete-test.fsh'
      );
      fs.ensureFileSync(filePath);
      // start spying after we know the file exists
      const deleteSpy = chai.spy.on(instance, 'handleDeletedFile');
      fs.removeSync(filePath);
      expect(deleteSpy).to.have.been.called.once;
      expect(deleteSpy).to.have.been.called.with(vscode.Uri.file(filePath));
    });

    test.skip('should not call any handlers on changes to non-fsh files', () => {
      // Test not yet implemented, because filesystem watchers are hard
    });
  });

  suite('#scanAll', () => {
    test('should have an entry in fileNames for each file path', () => {
      assert.equal(instance.fileNames.size, 8);

      assert.containsAllKeys(instance.fileNames, [
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles1.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles2.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'aliases.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'extensions.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'invariants.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh'),
        path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh')
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
    });

    test('should have an entry in nameLocations for each name', () => {
      assert.equal(instance.nameLocations.size, 15);
      assert.containsAllKeys(instance.nameLocations, [
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
        'MyValueSet'
      ]);
    });

    test('should have the location stored for a name with one location', () => {
      const expectedLocations = [
        new vscode.Location(
          vscode.Uri.file(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh')
          ),
          new vscode.Position(74, 0)
        )
      ];
      assert.sameDeepMembers(instance.nameLocations.get('AnotherCodeSystem'), expectedLocations);
    });

    test('should have all locations stored for a name with multiple locations', () => {
      const expectedLocations = [
        new vscode.Location(
          vscode.Uri.file(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'profiles', 'profiles1.fsh')
          ),
          new vscode.Position(8, 0)
        ),
        new vscode.Location(
          vscode.Uri.file(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh')
          ),
          new vscode.Position(9, 0)
        )
      ];
      assert.sameDeepMembers(instance.nameLocations.get('ReusedName'), expectedLocations);
    });
  });

  suite('#updateNamesFromFile', function () {
    beforeEach(() => {
      instance.scanAll();
    });

    afterEach(() => {
      instance.scanAll();
    });

    test('should add information from a new file path', () => {
      // clear out both maps
      instance.fileNames.clear();
      instance.nameLocations.clear();
      // update from one file
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      instance.updateNamesFromFile(filePath);
      assert.equal(instance.fileNames.size, 1);
      assert.hasAllKeys(instance.fileNames, [filePath]);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.hasAllKeys(instance.nameLocations, ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameLocations.get('SimpleRuleSet'), [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0))
      ]);
      assert.sameDeepMembers(instance.nameLocations.get('ParamRuleSet'), [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0))
      ]);
    });

    test('should add information from a new Uri', () => {
      test('should add information from a new file path', () => {
        // clear out both maps
        instance.fileNames.clear();
        instance.nameLocations.clear();
        // update from one file
        const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
        instance.updateNamesFromFile(vscode.Uri.file(filePath));
        assert.equal(instance.fileNames.size, 1);
        assert.hasAllKeys(instance.fileNames, [filePath]);
        assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
        assert.hasAllKeys(instance.nameLocations, ['SimpleRuleSet', 'ParamRuleSet']);
        assert.sameDeepMembers(instance.nameLocations.get('SimpleRuleSet'), [
          new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0))
        ]);
        assert.sameDeepMembers(instance.nameLocations.get('ParamRuleSet'), [
          new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0))
        ]);
      });
    });

    test('should add information from a TextDocument', async () => {
      // clear out both maps
      instance.fileNames.clear();
      instance.nameLocations.clear();
      // update from one TextDocument
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      const doc = await vscode.workspace.openTextDocument(filePath);
      instance.updateNamesFromFile(undefined, doc);
      assert.equal(instance.fileNames.size, 1);
      assert.hasAllKeys(instance.fileNames, [filePath]);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.hasAllKeys(instance.nameLocations, ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameLocations.get('SimpleRuleSet'), [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0))
      ]);
      assert.sameDeepMembers(instance.nameLocations.get('ParamRuleSet'), [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0))
      ]);
    });

    test('should update information from an existing file path', () => {
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'rulesets.fsh');
      // modify both maps
      instance.fileNames.set(filePath, ['ThisGotDeleted', 'SimpleRuleSet', 'ParamRuleSet']);
      instance.nameLocations.set('SimpleRuleSet', [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(5, 0))
      ]);
      instance.nameLocations.set('ParamRuleSet', [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(10, 0))
      ]);
      // update from one file
      instance.updateNamesFromFile(filePath);
      assert.sameMembers(instance.fileNames.get(filePath), ['SimpleRuleSet', 'ParamRuleSet']);
      assert.sameDeepMembers(instance.nameLocations.get('SimpleRuleSet'), [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0))
      ]);
      assert.sameDeepMembers(instance.nameLocations.get('ParamRuleSet'), [
        new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(3, 0))
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
      assert.lengthOf(instance.nameLocations.get('MyValueSet'), 1);
      assert.lengthOf(instance.nameLocations.get('ReusedName'), 2);
      instance.handleDeletedFile(filePath);
      assert.notExists(instance.fileNames.get(filePath));
      // MyValueSet is only in this file, so it should be removed
      assert.notExists(instance.nameLocations.get('MyValueSet'));
      // ReusedName is in one other file, so that entry should still exist
      assert.lengthOf(instance.nameLocations.get('ReusedName'), 1);
      assert.notEqual(instance.nameLocations.get('ReusedName')[0].uri.fsPath, filePath);
    });

    test('should remove information for a file Uri', () => {
      const filePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'valuesets.fsh');
      assert.exists(instance.fileNames.get(filePath));
      assert.lengthOf(instance.nameLocations.get('MyValueSet'), 1);
      assert.lengthOf(instance.nameLocations.get('ReusedName'), 2);
      instance.handleDeletedFile(vscode.Uri.file(filePath));
      assert.notExists(instance.fileNames.get(filePath));
      // MyValueSet is only in this file, so it should be removed
      assert.notExists(instance.nameLocations.get('MyValueSet'));
      // ReusedName is in one other file, so that entry should still exist
      assert.lengthOf(instance.nameLocations.get('ReusedName'), 1);
      assert.notEqual(instance.nameLocations.get('ReusedName')[0].uri.fsPath, filePath);
    });
  });

  suite('#handleDirtyFiles', function () {
    afterEach(async () => {
      // close the editor for codesystems.fsh
      await vscode.window.showTextDocument(
        vscode.Uri.file(
          path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'codesystems.fsh')
        )
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
      assert.notExists(instance.nameLocations.get('MyCodeSystem'));
      assert.exists(instance.nameLocations.get('AnimalCodeSystem'));
    });
  });
});
