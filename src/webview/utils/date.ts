// Date and number formatters used across the webview. All parse YYYY-MM-DD as a
// local date (never toISOString(), which drifts a day at positive UTC offsets).

import { MONTHS, WEEKDAYS } from './constants';

export function fmtLong(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function fmtShort(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

export function shiftDate(d: string, n: number): string {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  // Format from local parts, not toISOString(): at a positive UTC offset the
  // latter slices back to the previous day and the navigation never advances.
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Compact number: integers as-is, otherwise one decimal without a trailing .0. */
export function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.0', '');
}
