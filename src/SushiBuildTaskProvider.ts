import { Task, TaskGroup, TaskProvider, TaskScope, ShellExecution } from 'vscode';

export class SushiBuildTaskProvider implements TaskProvider {
  constructor() {}

  provideTasks(): Task[] | undefined {
    const sushiBuildTask = getSushiBuildTask();
    const tasks = [sushiBuildTask];
    return tasks;
  }

  resolveTask(_task: Task): Task | undefined {
    const task = _task.definition.task;
    if (task) {
      const sushiBuildTask = getSushiBuildTask();
      return sushiBuildTask;
    }
    return undefined;
  }
}

export function getSushiBuildTask(): Task {
  const sushiBuildTask = new Task(
    { type: 'fsh', task: 'Build SUSHI' },
    TaskScope.Workspace,
    'sushi', // name
    'fsh',
    new ShellExecution('sushi ${workspaceFolder}'),
    '$sushi' // problemMatcher
  );
  sushiBuildTask.presentationOptions = {
    clear: true
  };
  sushiBuildTask.group = TaskGroup.Build;
  return sushiBuildTask;
}
