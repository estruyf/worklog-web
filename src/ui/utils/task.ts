// Pure task adapters — no closure over component state, so they can live at
// module scope and be shared without reallocating per render.

import type { Task } from '../../model/types';
import { occursOn } from '../../model/recurrence';

export function clientIdOf(t: Task): string {
  return t.clientIds[0];
}

export function isDone(t: Task): boolean {
  return !!t.completed;
}

export function workedOnDate(t: Task, date: string): boolean {
  return (t.workedOn ?? []).includes(date);
}

/**
 * Whether a task belongs on `date`. A recurring task stores only its next due
 * date, so every later occurrence has to be derived from the rule — matching on
 * `due` alone would show it on one day and then nowhere until it was completed.
 */
export function dueOn(t: Task, date: string): boolean {
  if (t.due === date) {
    return true;
  }
  return !!t.repeat && !!t.due && occursOn(t.repeat, date, t.due);
}

export function linksOf(t: Task): string[] {
  return t.links.map((l) => l.url);
}
