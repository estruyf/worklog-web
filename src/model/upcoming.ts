// Upcoming work: which open tasks are still ahead of the day being looked at, and
// how far ahead each one is.
//
// The mirror of ./overdue, and the same shape: pure string math over "YYYY-MM-DD",
// no clock and no I/O, so the caller decides what "now" is and nothing scans in
// the background. Where that module answers "what am I late on", this one answers
// "what is coming" — which is what a due date was set for in the first place.
//
// A recurring task contributes its *next* occurrence and nothing else. The rule
// runs forever, so expanding it would bury every real deadline under an endless
// tail of "every Monday"; and the stored `due` is the only occurrence anyone has
// actually planned, since a rule only rolls forward when one is completed.

import type { Task } from './types';
import { addDays, daysSinceEpoch, isValidISODate, weekdayOf, withDayOfMonth } from '../util/date';

/** Whether the task is still open and due after `asOf`. */
export function isUpcoming(task: Task, asOf: string): boolean {
  // The `asOf` guard has no counterpart in `isOverdue`: before the app knows what
  // day it is, `asOf` is '' and every date sorts after it. "Nothing is late" falls
  // out of that comparison for free; "everything is planned" does not.
  if (!isValidISODate(asOf)) {
    return false;
  }
  return !task.completed && !!task.due && isValidISODate(task.due) && task.due > asOf;
}

/** How many days until the task is due; 0 for anything that isn't upcoming. */
export function daysUntil(task: Task, asOf: string): number {
  if (!isUpcoming(task, asOf)) {
    return 0;
  }
  return daysSinceEpoch(task.due as string) - daysSinceEpoch(asOf);
}

/** Every open task due after `asOf`, soonest first. */
export function collectUpcoming(tasks: Task[], asOf: string): Task[] {
  return tasks
    .filter((t) => isUpcoming(t, asOf))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.title.localeCompare(b.title));
}

/** The wait in words, for headers and tooltips ("In 3 days"). */
export function formatDaysUntil(days: number): string {
  if (days <= 0) {
    return 'Due today';
  }
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

export type UpcomingBucketId = 'tomorrow' | 'week' | 'next-week' | 'month' | 'later';

/** One horizon's worth of planned work. */
export interface UpcomingBucket {
  id: UpcomingBucketId;
  label: string;
  tasks: Task[];
}

/** The date each bucket reaches, in order; `later` is whatever is past the last
 *  of them. Each takes only what the buckets before it left, so a horizon that
 *  has already been passed — the end of the month, on the 30th — leaves its own
 *  bucket empty instead of stealing dates from the bucket after it. */
function bucketHorizons(asOf: string, weekStart: number): { id: UpcomingBucketId; label: string; end: string }[] {
  const endOfWeek = addDays(asOf, 6 - ((weekdayOf(asOf) - weekStart + 7) % 7));
  return [
    { id: 'tomorrow', label: 'Tomorrow', end: addDays(asOf, 1) },
    { id: 'week', label: 'Later this week', end: endOfWeek },
    { id: 'next-week', label: 'Next week', end: addDays(endOfWeek, 7) },
    { id: 'month', label: 'Later this month', end: withDayOfMonth(asOf, 'last') },
  ];
}

/** Upcoming tasks bucketed by how far off they are, nearest horizon first and
 *  empty horizons dropped. `weekStart` is the configured first day of the week,
 *  so "next week" means the same span the calendar grid draws. */
export function groupUpcoming(tasks: Task[], asOf: string, weekStart: number): UpcomingBucket[] {
  const horizons = bucketHorizons(asOf, weekStart);
  const buckets: UpcomingBucket[] = [
    ...horizons.map(({ id, label }) => ({ id, label, tasks: [] as Task[] })),
    { id: 'later', label: 'Later', tasks: [] },
  ];
  for (const task of collectUpcoming(tasks, asOf)) {
    const index = horizons.findIndex((h) => (task.due as string) <= h.end);
    buckets[index === -1 ? buckets.length - 1 : index].tasks.push(task);
  }
  return buckets.filter((b) => b.tasks.length > 0);
}
