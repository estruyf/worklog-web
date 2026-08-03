// The day bar's geometry. What matters here is that the widths always describe
// the hours honestly: a half day is half the track, an over-logged day grows past
// the target instead of clipping, and there is always something to click.

import { describe, it, expect } from 'vitest';
import type { WorklogEntry } from '../src/model/types';
import { deriveDayBar, previousLoggedDay } from '../src/ui/utils/dayBar';

const entry = (clientId: string, hours: number, date = '2026-08-03'): WorklogEntry => ({ date, clientId, hours });

describe('deriveDayBar', () => {
  it('sizes each entry by its share of the working day', () => {
    const bar = deriveDayBar([entry('acme', 4), entry('northwind', 2)], 8);
    expect(bar.segments.map((s) => [s.left, s.width])).toEqual([
      [0, 50],
      [50, 25],
    ]);
    expect(bar.total).toBe(6);
    expect(bar.remaining).toBe(2);
    expect(bar.over).toBe(0);
  });

  it('leaves the remainder as an unlogged slot that ends the track', () => {
    const bar = deriveDayBar([entry('acme', 4), entry('northwind', 2)], 8);
    expect(bar.unlogged).toEqual({ left: 75, width: 25 });
    expect(bar.unlogged!.left + bar.unlogged!.width).toBe(100);
  });

  it('drops the unlogged slot once the day is full', () => {
    const bar = deriveDayBar([entry('acme', 8)], 8);
    expect(bar.unlogged).toBeNull();
    expect(bar.segments[0].width).toBe(100);
    expect(bar.remaining).toBe(0);
  });

  it('grows past the target when the day is over-logged', () => {
    const bar = deriveDayBar([entry('acme', 8), entry('northwind', 2)], 8);
    expect(bar.over).toBe(2);
    expect(bar.scale).toBe(10);
    // The whole track is now 10h, so the 8h entry takes 80% of it and the target
    // marker lands where the working day ends.
    expect(bar.segments.map((s) => s.width)).toEqual([80, 20]);
    expect(bar.targetPercent).toBe(80);
    expect(bar.unlogged).toBeNull();
  });

  it('offers the whole track on an empty day, whatever the target says', () => {
    expect(deriveDayBar([], 8).unlogged).toEqual({ left: 0, width: 100 });
    expect(deriveDayBar([], 0).unlogged).toEqual({ left: 0, width: 100 });
  });

  it('rounds the sums it reports, so a half-hour split reads cleanly', () => {
    const bar = deriveDayBar([entry('acme', 1.1), entry('northwind', 2.2)], 8);
    expect(bar.total).toBe(3.3);
    expect(bar.remaining).toBe(4.7);
  });

  it('scales to what was logged when no working day is configured', () => {
    const bar = deriveDayBar([entry('acme', 3), entry('northwind', 1)], 0);
    expect(bar.scale).toBe(4);
    expect(bar.segments.map((s) => s.width)).toEqual([75, 25]);
    expect(bar.remaining).toBe(0);
    // Nothing to be over, so no amber and no target marker.
    expect(bar.over).toBe(0);
    expect(bar.targetPercent).toBe(100);
  });

  it('puts a tick at every second hour of a normal day', () => {
    expect(deriveDayBar([], 8).ticks.map((t) => t.hours)).toEqual([0, 2, 4, 6, 8]);
    expect(deriveDayBar([], 8).ticks.map((t) => t.percent)).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('previousLoggedDay', () => {
  const entries = [entry('acme', 8, '2026-07-31'), entry('acme', 4, '2026-07-29')];

  it('finds yesterday when yesterday has entries', () => {
    expect(previousLoggedDay(entries, '2026-08-01')).toBe('2026-07-31');
  });

  it('skips days with nothing logged — a Monday copies the Friday', () => {
    expect(previousLoggedDay(entries, '2026-08-03')).toBe('2026-07-31');
  });

  it('never looks at the selected day itself', () => {
    expect(previousLoggedDay(entries, '2026-07-31')).toBe('2026-07-29');
  });

  it('gives up past the lookback window', () => {
    expect(previousLoggedDay(entries, '2026-08-10')).toBeUndefined();
    expect(previousLoggedDay(entries, '2026-08-10', 14)).toBe('2026-07-31');
  });
});
