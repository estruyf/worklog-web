// The picker's pure decisions: which preset a rule belongs to, what expression a
// preset starts from, and where a rule moves when its start date does. All three
// are calendar reasoning over a `Recurrence`, not rendering, so they live next to
// the rules themselves — and they are what `test/recurrencePicker.test.ts` covers.

import {
  BUSINESS_DAYS,
  formatRecurrence,
  isBusinessWeek,
  type Recurrence,
} from './recurrence';
import { parseISODate, today, weekdayOf } from '../util/date';

export type PresetKind = 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export const RECURRENCE_PRESETS: { kind: PresetKind; label: string }[] = [
  { kind: 'daily', label: 'Daily' },
  { kind: 'weekdays', label: 'Weekdays' },
  { kind: 'weekly', label: 'Weekly' },
  { kind: 'biweekly', label: 'Every 2 weeks' },
  { kind: 'monthly', label: 'Monthly' },
  { kind: 'yearly', label: 'Yearly' },
];

/**
 * Which preset a rule belongs to, matched on its *shape* (unit + interval)
 * rather than its exact text. Picking a different weekday or day-of-month has to
 * leave the preset selected — matching on text would drop every edited rule into
 * "Custom" the moment it stopped being the seeded default.
 */
export function kindOf(rec: Recurrence): PresetKind | undefined {
  if (rec.unit === 'day' && rec.interval === 1) {
    return 'daily';
  }
  if (rec.unit === 'week' && rec.interval === 1) {
    return isBusinessWeek(rec.weekdays) ? 'weekdays' : 'weekly';
  }
  if (rec.unit === 'week' && rec.interval === 2) {
    return 'biweekly';
  }
  if (rec.unit === 'month' && rec.interval === 1) {
    return 'monthly';
  }
  if (rec.unit === 'year' && rec.interval === 1) {
    return 'yearly';
  }
  return undefined;
}

/**
 * The expression a preset starts from. Presets name their day explicitly
 * ("weekly on thu", not "weekly") and take it from the due date: a rule with no
 * day named falls back to whatever date it is next stepped from, which lets a
 * month-end clamp pull the series permanently earlier.
 *
 * The rule is built as a `Recurrence` and written out by `formatRecurrence`, so
 * a seed is canonical by construction rather than by a second copy of the
 * grammar agreeing with the first.
 */
export function seedFor(kind: PresetKind, due: string): string {
  const parts = parseISODate(due) ?? parseISODate(today())!;
  const iso = `${String(parts.y).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
  const weekday = weekdayOf(iso);
  return formatRecurrence({ anchor: 'schedule', ...shapeFor(kind, parts, weekday) });
}

/**
 * Re-point a rule at a new start date, keeping the parts a preset takes *from*
 * that date in step with it.
 *
 * `seedFor` reads the day off the start date, but the two controls are edited in
 * either order: picking "Yearly" on August 3rd and then setting the start to
 * October 1st used to leave the rule reading `yearly on 08-03`, so the first
 * occurrence landed on the chosen start and every one after it on the day the
 * chip happened to be clicked.
 *
 * Only date-derived parts move. A multi-day week and a "last day" month end are
 * choices made in their own control rather than echoes of the start date, so
 * they stay put — as does anything with no day to move (daily, weekdays, a rule
 * that names none).
 */
export function retargetToStart(rec: Recurrence, start: string): Recurrence {
  const parts = parseISODate(start);
  if (!parts) {
    return rec;
  }
  switch (rec.unit) {
    case 'week':
      return rec.weekdays?.length === 1 ? { ...rec, weekdays: [weekdayOf(start)] } : rec;
    case 'month':
      return typeof rec.monthDay === 'number' ? { ...rec, monthDay: parts.d } : rec;
    case 'year':
      return typeof rec.monthDay === 'number' ? { ...rec, month: parts.m, monthDay: parts.d } : rec;
    default:
      return rec;
  }
}

type PresetShape = Pick<Recurrence, 'unit' | 'interval' | 'weekdays' | 'monthDay' | 'month'>;

function shapeFor(kind: PresetKind, parts: { m: number; d: number }, weekday: number): PresetShape {
  switch (kind) {
    case 'daily':
      return { unit: 'day', interval: 1 };
    case 'weekdays':
      return { unit: 'week', interval: 1, weekdays: BUSINESS_DAYS };
    case 'weekly':
      return { unit: 'week', interval: 1, weekdays: [weekday] };
    case 'biweekly':
      return { unit: 'week', interval: 2, weekdays: [weekday] };
    case 'monthly':
      return { unit: 'month', interval: 1, monthDay: parts.d };
    case 'yearly':
      return { unit: 'year', interval: 1, month: parts.m, monthDay: parts.d };
  }
}
