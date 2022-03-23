import chai from 'chai';
import * as vscode from 'vscode';
import { getSushiBuildTask } from '../../SushiBuildTaskProvider';

const { assert } = chai;

suite('SushiBuildTaskProvider', () => {
  suite('getSushiBuildTask', () => {
    test('should return a Task with the correct properties', () => {
      const task = getSushiBuildTask();
      assert.isDefined(task);
      assert.deepEqual(task.definition, { type: 'fsh', task: 'Build SUSHI' });
      assert.equal(task.scope, 2); // TaskScope.Workspace
      assert.equal(task.name, 'sushi');
      assert.equal(task.source, 'fsh');
      assert.deepEqual(task.execution, new vscode.ShellExecution('sushi ${workspaceFolder}'));
      assert.deepEqual(task.problemMatchers, ['$sushi']);
      assert.deepEqual(task.presentationOptions, { clear: true });
      assert.equal(task.group, vscode.TaskGroup.Build);
    });
  });
});
