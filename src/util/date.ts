// Local-date helpers. Billing is keyed by the author's local day, so format from
// local time (not UTC) to avoid an evening edit landing on "tomorrow".

export function today(): string {
  return toISODate(new Date());
}

export function thisMonth(): string {
  return today().slice(0, 7);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Local timestamp down to the minute ("YYYY-MM-DD HH:mm"), for note stamps. */
export function nowStamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toISODate(d)} ${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Calendar arithmetic for recurrence. Unlike the formatters above — which read
// local time on purpose, so an evening edit lands on today — these are pure
// string→string calendar math done in UTC, so a DST transition can never shift
// a result by a day. Dates stay "YYYY-MM-DD" strings end to end; no Date object
// ever escapes this section.

export interface DateParts {
  y: number;
  /** 1-12. */
  m: number;
  d: number;
}

/** Parse "YYYY-MM-DD", rejecting impossible dates (e.g. 2026-02-30). */
export function parseISODate(iso: string): DateParts | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) {
    return undefined;
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    return undefined;
  }
  return { y, m, d };
}

export function isValidISODate(iso: string): boolean {
  return parseISODate(iso) !== undefined;
}

function formatParts(p: DateParts): string {
  return `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Number of days in a given month. `m` is 1-12. */
export function daysInMonth(y: number, m: number): number {
  // Day 0 of the *next* month is the last day of this one.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day of week, 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  const p = parseISODate(iso);
  if (!p) {
    return 0;
  }
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** Whole days since the epoch; the basis for day/week interval math. */
export function daysSinceEpoch(iso: string): number {
  const p = parseISODate(iso);
  if (!p) {
    return 0;
  }
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const p = parseISODate(iso);
  if (!p) {
    return iso;
  }
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return formatParts({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

/** Add months, clamping the day to the target month's length (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: string, n: number): string {
  const p = parseISODate(iso);
  if (!p) {
    return iso;
  }
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return formatParts({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

export function addYears(iso: string, n: number): string {
  return addMonths(iso, n * 12);
}

/** Move a date to a specific day within its own month; 'last' = month end.
 *  Numeric days past the month's length clamp (31 in February → the 28th). */
export function withDayOfMonth(iso: string, day: number | 'last'): string {
  const p = parseISODate(iso);
  if (!p) {
    return iso;
  }
  const max = daysInMonth(p.y, p.m);
  return formatParts({ y: p.y, m: p.m, d: day === 'last' ? max : Math.min(day, max) });
}

/** Index of the Sunday-started week containing `iso`, counted from the epoch.
 *  Used to test whether two dates are N weeks apart. (1970-01-01 was a Thursday,
 *  so the +4 shifts the boundary onto Sunday.) */
export function weekIndexOf(iso: string): number {
  return Math.floor((daysSinceEpoch(iso) + 4) / 7);
}
