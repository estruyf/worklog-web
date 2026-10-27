// "Put this on my list", recorded from outside the app — the to-do counterpart
// of logWork, behind the CLI's `add` command. Nothing has been worked on yet, so
// it never marks a day worked and never writes a note: a date is when the task is
// due, and what it is about goes in its description.
//
// Like logWork it has to be idempotent, because the CLI replays it after a lost
// push race: a task that already matches is reported and left exactly as it is.

import { Store } from '../store';
import type { Task } from '../model/types';
import { createTask } from './tasks';
import { findTask } from './logWork';
import { requireParent } from './editTask';

export interface AddTaskInput {
  clientId: string;
  title: string;
  /** The issue/ticket url, when the to-do has one. */
  link?: string;
  /** YYYY-MM-DD the task is due. */
  due?: string;
  /** One of the ids in `model/priority`. */
  priority?: string;
  description?: string;
  tags?: string[];
  /** The parent task's id, making this one a subtask. */
  parentId?: string;
}

export interface AddTaskResult {
  task: Task;
  created: boolean;
}

export async function addTask(store: Store, input: AddTaskInput): Promise<AddTaskResult> {
  const existing = findTask(store, input);
  if (existing) {
    return { task: existing, created: false };
  }
  if (input.parentId) {
    requireParent(store, input.parentId);
  }
  const task = await createTask(store, {
    clientId: input.clientId,
    title: input.title,
    links: input.link ? [input.link] : undefined,
    due: input.due,
    priority: input.priority,
    description: input.description,
    tags: input.tags,
    parentId: input.parentId,
  });
  return { task: store.db.getTask(task.id) ?? task, created: true };
}
