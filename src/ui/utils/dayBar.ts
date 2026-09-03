// The day bar's geometry: what slice of the day each ledger entry takes and
// where the unlogged remainder sits. Pure — no React, no DOM — so the awkward
// cases (an over-logged day, an empty one, an unset target) are unit-testable on
// their own. See test/dayBar.test.ts.

import type { WorklogEntry } from '../../model/types';
import { shiftDate } from './date';

/** Hours are half-hours in practice, but a sum of them is still floating point:
 *  0.1 + 0.2 has no business reaching a label. */
export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One entry as it is drawn on the track. `left`/`width` are percentages of the
 *  whole track, so a segment is positioned rather than flexed: a segment only
 *  spans the hours it claims if the gutters come out of its own box instead of
 *  the space between them. */
export interface DaySegment {
  entry: WorklogEntry;
  left: number;
  width: number;
}

export interface DayBarModel {
  segments: DaySegment[];
  /** Everything logged on the day. */
  total: number;
  /** The configured working day; 0 when it is unset, which drops the target. */
  target: number;
  /** Hours still to log before the day is full; 0 once it is. */
  remaining: number;
  /** Hours logged past the target; 0 until the day is full. Over-logging is
   *  allowed — the bar grows past the target rather than refusing the entry. */
  over: number;
  /** Hours the whole track spans: the target, or the total once it exceeds it. */
  scale: number;
  /** The dashed "unlogged" slot at the end of the bar, absent once the day is
   *  full. An empty day is all slot whatever the target says, so there is always
   *  something to click to log the first entry. */
  unlogged: { left: number; width: number } | null;
  /** Where the target falls on the track, as a percentage. 100 unless the day is
   *  over-logged, which is the only time the marker is worth drawing. */
  targetPercent: number;
}

export function deriveDayBar(entries: WorklogEntry[], hoursPerDay: number): DayBarModel {
  const target = hoursPerDay > 0 ? hoursPerDay : 0;
  const total = roundHours(entries.reduce((sum, e) => sum + Math.max(0, e.hours), 0));
  const remaining = roundHours(Math.max(0, target - total));
  // With no working day configured there is nothing to be over: the bar is then
  // just a proportional read of what was logged.
  const over = target > 0 ? roundHours(Math.max(0, total - target)) : 0;
  // `|| 1` keeps the division safe on a day with no target and nothing logged;
  // every width is then 0 and the empty slot below covers the track.
  const scale = Math.max(target, total) || 1;

  let left = 0;
  const segments = entries.map((entry) => {
    const width = (Math.max(0, entry.hours) / scale) * 100;
    const segment = { entry, left, width };
    left += width;
    return segment;
  });

  return {
    segments,
    total,
    target,
    remaining,
    over,
    scale,
    unlogged: total === 0 ? { left: 0, width: 100 } : remaining > 0 ? { left, width: (remaining / scale) * 100 } : null,
    targetPercent: over > 0 ? (target / scale) * 100 : 100,
  };
}

/** The most recent day before `date` that has any entries, within `lookback`
 *  days. Undefined when nothing was logged in that window — a Monday after a
 *  fortnight off has nothing to copy, and the button that offers it should say
 *  so by not being there. */
export function previousLoggedDay(entries: WorklogEntry[], date: string, lookback = 7): string | undefined {
  const logged = new Set(entries.map((e) => e.date));
  for (let back = 1; back <= lookback; back++) {
    const day = shiftDate(date, -back);
    if (logged.has(day)) {
      return day;
    }
  }
  return undefined;
}
