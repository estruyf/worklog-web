// Recurrence rules for repeating tasks and to-dos. A rule is stored as one
// human-readable `- repeat:` line (see parseRecurrence for the grammar) and is
// pure data: no scheduler, no background job. The next occurrence is computed
// on demand when a task is completed, so nothing has to run while the app is
// closed.
//
// Everything here is pure string→string calendar math over "YYYY-MM-DD", so it
// unit-tests without any I/O or clock.

import {
  addDays,
  addMonths,
  addYears,
  daysSinceEpoch,
  isValidISODate,
  parseISODate,
  weekIndexOf,
  weekdayOf,
  withDayOfMonth,
} from '../util/date';

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

/**
 * What the next occurrence is measured from.
 * - `schedule`   — the fixed series. Skipping Monday's standup does not move
 *                  Tuesday's. This is the default.
 * - `completion` — a cadence measured from when the task was actually done.
 *                  "Deep clean every 30 days" starts its 30 days on completion.
 */
export type RecurrenceAnchor = 'schedule' | 'completion';

export interface Recurrence {
  unit: RecurrenceUnit;
  /** Repeat every N units; always >= 1. */
  interval: number;
  /** Weekly rules only: 0 = Sunday … 6 = Saturday, sorted ascending. */
  weekdays?: number[];
  /** Monthly/yearly rules: day of month, or 'last' for the month's final day. */
  monthDay?: number | 'last';
  /** Yearly rules only: 1-12. */
  month?: number;
  anchor: RecurrenceAnchor;
  /** Inclusive last date of the series (YYYY-MM-DD); past it, the task closes for good. */
  until?: string;
}

const WEEKDAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_ALIASES: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const BUSINESS_DAYS = [1, 2, 3, 4, 5];

/** Upper bound on occurrence stepping, so a malformed rule can never hang the tab. */
const MAX_STEPS = 800;

// ---------------------------------------------------------------------------
// Parsing

const HEAD_SUGAR: Record<string, { unit: RecurrenceUnit; interval: number; weekdays?: number[] }> = {
  daily: { unit: 'day', interval: 1 },
  weekly: { unit: 'week', interval: 1 },
  monthly: { unit: 'month', interval: 1 },
  yearly: { unit: 'year', interval: 1 },
  annually: { unit: 'year', interval: 1 },
  weekdays: { unit: 'week', interval: 1, weekdays: BUSINESS_DAYS },
};

const UNIT_WORDS: Record<string, RecurrenceUnit> = {
  day: 'day', days: 'day',
  week: 'week', weeks: 'week',
  month: 'month', months: 'month',
  year: 'year', years: 'year',
};

/**
 * Parse a `- repeat:` expression. Returns undefined for anything unrecognised —
 * callers treat that as "not a recurring task" rather than an error, so a typo
 * degrades to a plain one-off instead of losing the block.
 *
 * Grammar:
 *   daily | weekdays | weekly | monthly | yearly
 *   every [N] day|week|month|year(s)
 *   ...optionally followed by `on <spec>`:
 *     weekly  → `on mon` / `on mon,wed,fri`
 *     monthly → `on 15` / `on last`
 *     yearly  → `on 03-14` / `on 03-last`
 */
export function parseRecurrence(input: string): Recurrence | undefined {
  const text = input.trim().toLowerCase();
  if (!text) {
    return undefined;
  }

  const [headText, specText] = splitOn(text);
  const head = parseHead(headText);
  if (!head) {
    return undefined;
  }

  const rec: Recurrence = {
    unit: head.unit,
    interval: head.interval,
    weekdays: head.weekdays,
    anchor: 'schedule',
  };

  if (specText !== undefined) {
    if (!applySpec(rec, specText)) {
      return undefined;
    }
  }
  return rec;
}

/** Split `weekly on mon,thu` into its head and its ` on ` spec. */
function splitOn(text: string): [string, string | undefined] {
  const m = /^(.*?)\s+on\s+(.+)$/.exec(text);
  return m ? [m[1].trim(), m[2].trim()] : [text, undefined];
}

function parseHead(text: string): { unit: RecurrenceUnit; interval: number; weekdays?: number[] } | undefined {
  const sugar = HEAD_SUGAR[text];
  if (sugar) {
    return { ...sugar };
  }
  // `every 3 weeks`, and `every week` as a synonym for interval 1.
  const m = /^every\s+(?:(\d+)\s+)?([a-z]+)$/.exec(text);
  if (!m) {
    return undefined;
  }
  const unit = UNIT_WORDS[m[2]];
  if (!unit) {
    return undefined;
  }
  const interval = m[1] === undefined ? 1 : Number(m[1]);
  if (!Number.isInteger(interval) || interval < 1 || interval > 1000) {
    return undefined;
  }
  return { unit, interval };
}

/** Apply the `on ...` part; returns false if it doesn't fit the rule's unit. */
function applySpec(rec: Recurrence, spec: string): boolean {
  switch (rec.unit) {
    case 'week': {
      const days = spec
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((name) => WEEKDAY_ALIASES[name]);
      if (!days.length || days.some((d) => d === undefined)) {
        return false;
      }
      rec.weekdays = [...new Set(days)].sort((a, b) => a - b);
      return true;
    }
    case 'month': {
      const day = parseMonthDay(spec);
      if (day === undefined) {
        return false;
      }
      rec.monthDay = day;
      return true;
    }
    case 'year': {
      const m = /^(\d{1,2})-(\d{1,2}|last)$/.exec(spec);
      if (!m) {
        return false;
      }
      const month = Number(m[1]);
      const day = parseMonthDay(m[2]);
      if (month < 1 || month > 12 || day === undefined) {
        return false;
      }
      rec.month = month;
      rec.monthDay = day;
      return true;
    }
    default:
      // Daily rules have nothing to qualify.
      return false;
  }
}

function parseMonthDay(spec: string): number | 'last' | undefined {
  if (spec === 'last') {
    return 'last';
  }
  if (!/^\d{1,2}$/.test(spec)) {
    return undefined;
  }
  const n = Number(spec);
  return n >= 1 && n <= 31 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Formatting

/** Canonical `- repeat:` text. parseRecurrence(formatRecurrence(r)) round-trips. */
export function formatRecurrence(rec: Recurrence): string {
  const head = formatHead(rec);
  const spec = formatSpec(rec);
  return spec ? `${head} on ${spec}` : head;
}

function formatHead(rec: Recurrence): string {
  if (rec.interval === 1) {
    if (rec.unit === 'week' && isBusinessWeek(rec.weekdays)) {
      return 'weekdays';
    }
    return { day: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }[rec.unit];
  }
  return `every ${rec.interval} ${rec.unit}s`;
}

function formatSpec(rec: Recurrence): string | undefined {
  switch (rec.unit) {
    case 'week':
      // `weekdays` already encodes Mon-Fri in the head; don't repeat it.
      if (!rec.weekdays?.length || (rec.interval === 1 && isBusinessWeek(rec.weekdays))) {
        return undefined;
      }
      return rec.weekdays.map((d) => WEEKDAY_NAMES[d]).join(',');
    case 'month':
      return rec.monthDay === undefined ? undefined : String(rec.monthDay);
    case 'year':
      if (rec.month === undefined || rec.monthDay === undefined) {
        return undefined;
      }
      return `${String(rec.month).padStart(2, '0')}-${
        rec.monthDay === 'last' ? 'last' : String(rec.monthDay).padStart(2, '0')
      }`;
    default:
      return undefined;
  }
}

function isBusinessWeek(weekdays: number[] | undefined): boolean {
  return !!weekdays && weekdays.length === 5 && BUSINESS_DAYS.every((d) => weekdays.includes(d));
}

/** Human sentence for the UI, e.g. "Every 2 weeks on Thursday". */
export function describeRecurrence(rec: Recurrence): string {
  const base = describeBase(rec);
  const suffix = rec.anchor === 'completion' ? ' after completion' : '';
  const until = rec.until ? `, until ${rec.until}` : '';
  return `${base}${suffix}${until}`;
}

function describeBase(rec: Recurrence): string {
  const every = rec.interval === 1 ? 'Every' : `Every ${rec.interval}`;
  switch (rec.unit) {
    case 'day':
      return rec.interval === 1 ? 'Every day' : `${every} days`;
    case 'week': {
      if (rec.interval === 1 && isBusinessWeek(rec.weekdays)) {
        return 'Every weekday';
      }
      const unit = rec.interval === 1 ? 'week' : 'weeks';
      const days = rec.weekdays?.length
        ? ` on ${listWords(rec.weekdays.map((d) => WEEKDAY_LABELS[d]))}`
        : '';
      return `${every} ${unit}${days}`;
    }
    case 'month': {
      const unit = rec.interval === 1 ? 'month' : 'months';
      const day =
        rec.monthDay === undefined
          ? ''
          : rec.monthDay === 'last'
            ? ' on the last day'
            : ` on the ${ordinal(rec.monthDay)}`;
      return `${every} ${unit}${day}`;
    }
    case 'year': {
      const unit = rec.interval === 1 ? 'year' : 'years';
      if (rec.month === undefined || rec.monthDay === undefined) {
        return `${every} ${unit}`;
      }
      const monthName = MONTH_LABELS[rec.month - 1];
      const day = rec.monthDay === 'last' ? 'the last day' : ordinal(rec.monthDay);
      return `${every} ${unit} on ${monthName} ${day}`;
    }
  }
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) {
    return `${n}th`;
  }
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

function listWords(words: string[]): string {
  if (words.length <= 1) {
    return words[0] ?? '';
  }
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Occurrences

/**
 * The first occurrence strictly after `base`, or undefined once the series has
 * run past its `until` date.
 *
 * For `schedule` rules `base` is normally the occurrence just completed (the
 * task's current due date), which is what makes a backlog catch up one step at
 * a time instead of skipping straight to today. `base` need not sit on the
 * series — an off-series date is treated as the phase origin.
 */
export function nextOccurrence(rec: Recurrence, base: string): string | undefined {
  if (!isValidISODate(base)) {
    return undefined;
  }
  const next = rec.anchor === 'completion' ? stepFromCompletion(rec, base) : stepInSeries(rec, base);
  if (!next) {
    return undefined;
  }
  if (rec.until && next > rec.until) {
    return undefined;
  }
  return next;
}

/**
 * Where a series starts: the first occurrence on or after `from`.
 *
 * A rule on its own doesn't place a task on any day — only a due date does — so
 * a recurring task without one would never surface in the day view. This is what
 * seeds that first due date.
 *
 * Rules that name their days (weekdays, a day-of-month, a date) have real slots,
 * so the first one lands on the next matching slot — "monthly on 1" set up
 * mid-month starts on the 1st, not today. Pure-interval rules ("daily", "every
 * 10 days") have no slots of their own and start immediately.
 *
 * Callers that want a series to start somewhere else pass that day as `from`;
 * a recurring task's due date is what anchors it from then on.
 */
export function firstOccurrence(rec: Recurrence, from: string): string | undefined {
  if (!isValidISODate(from)) {
    return undefined;
  }
  const namesDays =
    !!rec.weekdays?.length || rec.monthDay !== undefined || rec.month !== undefined;
  // "On or after `from`" is "strictly after the day before `from`". The anchor is
  // forced to `schedule` because a cadence has nothing to measure from yet, and
  // the interval is dropped: which months a quarterly rule lands in is decided
  // *by* its first occurrence, so there is no phase to count from yet. Stepping
  // with the real interval would instead phase the series off whichever day it
  // happened to be set up on — "every 3 months on the 1st" written in August
  // would start in November rather than on the 1st of August.
  const start = namesDays
    ? nextOccurrence({ ...rec, interval: 1, anchor: 'schedule', until: undefined }, addDays(from, -1))
    : from;
  if (!start || (rec.until && start > rec.until)) {
    return undefined;
  }
  return start;
}

/**
 * Where a task's due date moves after being completed. `schedule` rules advance
 * along the series from the due date they had; `completion` rules measure the
 * interval from the day the work actually happened.
 */
export function nextDueAfterCompletion(
  rec: Recurrence,
  currentDue: string | undefined,
  completedDate: string,
): string | undefined {
  const base = rec.anchor === 'completion' ? completedDate : (currentDue ?? completedDate);
  return nextOccurrence(rec, base);
}

/**
 * Whether the series lands on `date`, given that its next occurrence is `from`.
 *
 * A recurring task only ever stores its *next* due date, so a day view that
 * matches on the due date alone can't see any occurrence beyond the first. This
 * answers the question directly instead of materialising the series.
 *
 * Only dates from `from` onward count: earlier occurrences are already closed
 * (each one archived as its own block) or were missed. Cadence rules can only
 * confirm the occurrence already scheduled — where the ones after it land
 * depends on when each gets completed, which hasn't happened yet.
 */
export function occursOn(rec: Recurrence, date: string, from: string): boolean {
  if (!isValidISODate(date) || !isValidISODate(from) || date < from) {
    return false;
  }
  if (rec.until && date > rec.until) {
    return false;
  }
  if (date === from) {
    return true;
  }
  if (rec.anchor === 'completion') {
    return false;
  }
  switch (rec.unit) {
    case 'day':
      return (daysSinceEpoch(date) - daysSinceEpoch(from)) % rec.interval === 0;
    case 'week':
      if (!rec.weekdays?.length) {
        return (daysSinceEpoch(date) - daysSinceEpoch(from)) % (7 * rec.interval) === 0;
      }
      return (
        rec.weekdays.includes(weekdayOf(date)) &&
        (weekIndexOf(date) - weekIndexOf(from)) % rec.interval === 0
      );
    case 'month': {
      const start = parseISODate(from);
      const on = parseISODate(date);
      if (!start || !on) {
        return false;
      }
      const day = rec.monthDay ?? start.d;
      // Compare against the day the rule resolves to in *this* month, so a
      // clamped month end (the 31st in February) still counts as a hit.
      if (withDayOfMonth(date, day) !== date) {
        return false;
      }
      return ((on.y - start.y) * 12 + (on.m - start.m)) % rec.interval === 0;
    }
    case 'year': {
      const start = parseISODate(from);
      const on = parseISODate(date);
      if (!start || !on) {
        return false;
      }
      if (on.m !== (rec.month ?? start.m)) {
        return false;
      }
      if (withDayOfMonth(date, rec.monthDay ?? start.d) !== date) {
        return false;
      }
      return (on.y - start.y) % rec.interval === 0;
    }
  }
}

/** Cadence rules: step the raw interval off the completion date. */
function stepFromCompletion(rec: Recurrence, base: string): string | undefined {
  let next: string;
  switch (rec.unit) {
    case 'day':
      next = addDays(base, rec.interval);
      break;
    case 'week':
      next = addDays(base, 7 * rec.interval);
      break;
    case 'month':
      next = addMonths(base, rec.interval);
      break;
    case 'year':
      next = addYears(base, rec.interval);
      break;
  }
  if (rec.monthDay !== undefined) {
    next = withDayOfMonth(next, rec.monthDay);
  }
  // A cadence that also names weekdays rolls forward onto the next allowed one.
  if (rec.weekdays?.length) {
    next = rollToWeekday(next, rec.weekdays);
  }
  return next > base ? next : undefined;
}

function stepInSeries(rec: Recurrence, base: string): string | undefined {
  switch (rec.unit) {
    case 'day':
      return addDays(base, rec.interval);
    case 'week':
      return nextWeekly(rec, base);
    case 'month':
      return nextMonthly(rec, base);
    case 'year':
      return nextYearly(rec, base);
  }
}

function nextWeekly(rec: Recurrence, base: string): string | undefined {
  if (!rec.weekdays?.length) {
    return addDays(base, 7 * rec.interval);
  }
  // Scan forward for the next named weekday that also lands in an "on" week.
  const baseWeek = weekIndexOf(base);
  for (let i = 1; i <= MAX_STEPS; i++) {
    const cand = addDays(base, i);
    if (!rec.weekdays.includes(weekdayOf(cand))) {
      continue;
    }
    if ((weekIndexOf(cand) - baseWeek) % rec.interval === 0) {
      return cand;
    }
  }
  return undefined;
}

function nextMonthly(rec: Recurrence, base: string): string | undefined {
  const parts = parseISODate(base);
  if (!parts) {
    return undefined;
  }
  const day = rec.monthDay ?? parts.d;
  // Step from the 1st and re-apply the day each time, so a month-end clamp
  // (Jan 31 → Feb 28) never drags the rest of the series down with it.
  const firstOfMonth = withDayOfMonth(base, 1);
  for (let k = 0; k <= MAX_STEPS; k++) {
    const cand = withDayOfMonth(addMonths(firstOfMonth, k * rec.interval), day);
    if (cand > base) {
      return cand;
    }
  }
  return undefined;
}

function nextYearly(rec: Recurrence, base: string): string | undefined {
  const parts = parseISODate(base);
  if (!parts) {
    return undefined;
  }
  const month = rec.month ?? parts.m;
  const day = rec.monthDay ?? parts.d;
  for (let k = 0; k <= MAX_STEPS; k++) {
    const year = parts.y + k * rec.interval;
    const cand = withDayOfMonth(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`, day);
    if (cand > base) {
      return cand;
    }
  }
  return undefined;
}

function rollToWeekday(iso: string, weekdays: number[]): string {
  for (let i = 0; i < 7; i++) {
    const cand = addDays(iso, i);
    if (weekdays.includes(weekdayOf(cand))) {
      return cand;
    }
  }
  return iso;
}
