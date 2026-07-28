// Pure calendar derivation: the day cells of the visible period (a whole month or
// a single week) and the per-client rollup of what was worked in it. Kept free of
// React/DOM so it can be unit-tested directly, like the archive derivation.

import { isGeneralTodoClientId } from '../../model/todos';
import type { Task, WorklogEntry } from '../../model/types';
import { isEventWorklogClientId } from '../../model/worklog';
import { MONTHS } from './constants';
import { monthLabel, shiftDate } from './date';
import { clientIdOf, isDone } from './task';

/** Accent for event pseudo-clients (vacation, sick, …), which have no client color.
 *  Fixed to the yellow brand color (--color-brand-500). */
export const EVENT_COLOR = '#E2BE2E';

/** How much of the calendar is on screen: a whole month or a single week. */
export type CalendarMode = 'month' | 'week';

/** The year-month (YYYY-MM) a date string falls in. */
export function ymOf(date: string): string {
  return date.slice(0, 7);
}

/** The date (YYYY-MM-DD) the week containing `date` starts on, where `weekStart`
 * is the configured first day of the week (0 = Sunday … 6 = Saturday). */
export function startOfWeek(date: string, weekStart: number): string {
  const back = (new Date(date + 'T00:00:00').getDay() - weekStart + 7) % 7;
  return shiftDate(date, -back);
}

/** All day cells for a month (YYYY-MM), starting on `weekStart` and padded with
 * leading/trailing nulls so the grid always fills whole weeks. */
export function monthCells(ym: string, weekStart: number): (string | null)[] {
  const [y, m] = ym.split('-').map(Number);
  // Days from the configured week start to the 1st, wrapped into 0–6.
  const lead = (new Date(y, m - 1, 1).getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/** The seven day cells of the week containing `date`. */
export function weekCells(date: string, weekStart: number): string[] {
  const start = startOfWeek(date, weekStart);
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
}

/** Day cells for the visible period. The cursor is always a full date, so
 * switching modes keeps the calendar parked on the same day. */
export function calendarCells(mode: CalendarMode, cursor: string, weekStart: number): (string | null)[] {
  return mode === 'week' ? weekCells(cursor, weekStart) : monthCells(ymOf(cursor), weekStart);
}

/** Step the cursor by whole periods. Month steps land on the 1st, so repeated
 * paging can't skip a short month the way keeping the day-of-month would. */
export function shiftPeriod(mode: CalendarMode, cursor: string, n: number, weekStart: number): string {
  if (mode === 'week') {
    return shiftDate(startOfWeek(cursor, weekStart), n * 7);
  }
  const [y, m] = ymOf(cursor).split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Heading for the visible period: "Jul 2026", or "20 – 26 Jul 2026" for a week
 * (the start's month/year is only repeated when the week straddles a boundary). */
export function periodLabel(mode: CalendarMode, cursor: string, weekStart: number): string {
  if (mode === 'month') {
    return monthLabel(ymOf(cursor));
  }
  const start = startOfWeek(cursor, weekStart);
  const end = shiftDate(start, 6);
  const [sy, sm, sd] = start.split('-');
  const [ey, em, ed] = end.split('-');
  const startDay = String(Number(sd));
  const from = sy === ey ? (sm === em ? startDay : `${startDay} ${MONTHS[Number(sm) - 1]}`) : `${startDay} ${MONTHS[Number(sm) - 1]} ${sy}`;
  return `${from} – ${Number(ed)} ${MONTHS[Number(em) - 1]} ${ey}`;
}

/** True when the visible period contains `date`. */
export function periodContains(cells: (string | null)[], date: string): boolean {
  return cells.some((c) => c === date);
}

/** A task worked on during the visible period. */
export interface WorkedItem {
  id: string;
  title: string;
  /** Dates inside the period the task was worked on (or completed), sorted. */
  dates: string[];
  done: boolean;
}

/** One client's work in the visible period: the time logged against it plus the
 * tasks that were actually worked on. */
export interface ClientWorkGroup {
  id: string;
  name: string;
  color: string;
  hours: number;
  /** Distinct days with logged time, which is not the same as hours / hoursPerDay. */
  loggedDays: number;
  items: WorkedItem[];
}

/** The read-model helpers the derivation needs, injected so it stays pure. */
export interface CalendarWorkDeps {
  clientName: (id: string) => string;
  colorOf: (id: string) => string;
}

/** Rolls the period up per client: logged hours from the worklog, worked tasks
 * from their worked-on dates. Two buckets are left out: general to-dos, which
 * aren't client work and are hidden from the billing surfaces this view
 * summarises, and event pseudo-clients (vacation, sick, …), which can never
 * carry tasks — the calendar grid above already shows those days. */
export function deriveWorkedByClient(
  cells: (string | null)[],
  tasks: Task[],
  worklog: WorklogEntry[],
  deps: CalendarWorkDeps,
): ClientWorkGroup[] {
  const inPeriod = new Set(cells.filter((c): c is string => !!c));

  const buckets = new Map<string, { hours: number; days: Set<string>; items: WorkedItem[] }>();
  const bucketFor = (id: string) => {
    let b = buckets.get(id);
    if (!b) {
      b = { hours: 0, days: new Set(), items: [] };
      buckets.set(id, b);
    }
    return b;
  };

  for (const w of worklog) {
    if (!inPeriod.has(w.date) || isGeneralTodoClientId(w.clientId) || isEventWorklogClientId(w.clientId)) {
      continue;
    }
    const b = bucketFor(w.clientId);
    b.hours += w.hours;
    b.days.add(w.date);
  }

  for (const t of tasks) {
    const cid = clientIdOf(t);
    if (!cid || isGeneralTodoClientId(cid)) {
      continue;
    }
    const dates = (t.workedOn ?? []).filter((d) => inPeriod.has(d));
    // Closing a task counts as working on it, even when that day was never ticked.
    if (t.completed && inPeriod.has(t.completed) && !dates.includes(t.completed)) {
      dates.push(t.completed);
    }
    if (dates.length === 0) {
      continue;
    }
    bucketFor(cid).items.push({ id: t.id, title: t.title, dates: dates.sort(), done: isDone(t) });
  }

  return [...buckets.entries()]
    .map(([id, b]) => ({
      id,
      name: deps.clientName(id),
      color: deps.colorOf(id),
      hours: Math.round(b.hours * 100) / 100,
      loggedDays: b.days.size,
      items: b.items.sort((x, y) => x.dates[0].localeCompare(y.dates[0]) || x.title.localeCompare(y.title)),
    }))
    // Busiest first, so the period reads top-down by where the time actually went.
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
}
