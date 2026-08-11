// Pure task adapters — no closure over component state, so they can live at
// module scope and be shared without reallocating per render.

import type { Task } from '../../model/types';
import { occursOn } from '../../model/recurrence';
import { fmtLong, fmtShort } from './date';

export function clientIdOf(t: Task): string {
  return t.clientIds[0];
}

export function isDone(t: Task): boolean {
  return !!t.completed;
}

export function workedOnDate(t: Task, date: string): boolean {
  return (t.workedOn ?? []).includes(date);
}

/** What the worked-on toggle says about itself, wherever it is rendered — the
 *  row, the subtask list, the task header. One helper because a briefcase glyph
 *  on its own says nothing: `action` names the act ("Log work today"), `title`
 *  spells out the day it lands on and what that gets you, since the toggle
 *  writes to the *selected* day and that is often not today. */
export function workedLabels(worked: boolean, date: string, today: string): { action: string; title: string } {
  const when = date === today ? 'today' : `on ${fmtShort(date)}`;
  return {
    action: worked ? `Worked ${when}` : `Log work ${when}`,
    title: worked
      ? `Logged as worked on ${fmtLong(date)} — press to take it off that day`
      : `Log this task as worked on ${fmtLong(date)} — it then shows under that day's worked tasks`,
  };
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
