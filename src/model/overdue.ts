// Overdue detection: which open tasks are past the day they were due.
//
// Nothing scans in the background — a due date is a plain string on the task, so
// "overdue" is a comparison, evaluated wherever it's rendered. That is also what
// makes it work for recurring tasks: a rule only rolls its `due` forward when the
// occurrence is completed, so an invoice scheduled "monthly on 1" that landed on
// a Saturday still reads as due the 1st on Monday morning — exactly the day it
// needs to resurface.
//
// Pure string math over "YYYY-MM-DD" (no clock, no I/O), so the caller decides
// what "now" is: today for the nav badge and the Overdue view, the selected day
// for the day overview.

import type { Task } from './types';
import { daysSinceEpoch, isValidISODate } from '../util/date';

/** Whether the task was due before `asOf` and nobody has closed it since. */
export function isOverdue(task: Task, asOf: string): boolean {
  return !task.completed && !!task.due && isValidISODate(task.due) && task.due < asOf;
}

/** How many days late the task is; 0 for anything that isn't overdue. */
export function daysOverdue(task: Task, asOf: string): number {
  if (!isOverdue(task, asOf)) {
    return 0;
  }
  return daysSinceEpoch(asOf) - daysSinceEpoch(task.due as string);
}

/** Every open task past its due date, longest overdue first. */
export function collectOverdue(tasks: Task[], asOf: string): Task[] {
  return tasks
    .filter((t) => isOverdue(t, asOf))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.title.localeCompare(b.title));
}

/** Lateness in words, for headers and tooltips ("3 days late"). */
export function formatDaysLate(days: number): string {
  if (days <= 0) {
    return 'Due today';
  }
  return days === 1 ? '1 day late' : `${days} days late`;
}
