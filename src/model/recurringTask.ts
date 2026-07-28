// The one invariant that ties a recurrence rule to the rest of the app: a
// recurring task always carries a due date.
//
// The rule says how often; only the due date says *when*, and it is what every
// day/calendar view matches against. A task with a rule and no due date has no
// day to appear on, so it would sit invisible in the to-do list forever.

import type { Task } from './types';
import { firstOccurrence } from './recurrence';
import { today } from '../util/date';

/**
 * Fill in the start of the series when a recurring task has no due date.
 *
 * Applied on every write *and* on every rebuild, because the gap can arrive from
 * outside the write paths: a hand-edited markdown file, or a task that predates
 * this invariant. Seeding at index time keeps the in-memory task consistent
 * without rewriting files behind the user's back — the derived date is persisted
 * the next time the task is edited or completed.
 */
export function withSeededDue(task: Task, from = today()): Task {
  if (!task.repeat || task.due || task.completed) {
    return task;
  }
  const start = firstOccurrence(task.repeat, from);
  return start ? { ...task, due: start } : task;
}
