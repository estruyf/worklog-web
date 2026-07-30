// The recurrence picker's two pure decisions: which preset chip a rule belongs
// to, and what expression a chip starts from. Both are easy to get subtly wrong
// — matching a preset by its exact text drops every edited rule into "Custom",
// and a preset that names no day lets the series drift.

import { describe, it, expect } from 'vitest';
import { kindOf, seedFor } from '../src/model/recurrencePresets';
import { formatRecurrence, parseRecurrence, type Recurrence } from '../src/model/recurrence';

function rec(expr: string): Recurrence {
  const parsed = parseRecurrence(expr);
  expect(parsed, `expected "${expr}" to parse`).toBeDefined();
  return parsed!;
}

describe('kindOf', () => {
  it('maps each preset shape to its chip', () => {
    expect(kindOf(rec('daily'))).toBe('daily');
    expect(kindOf(rec('weekdays'))).toBe('weekdays');
    expect(kindOf(rec('weekly on thu'))).toBe('weekly');
    expect(kindOf(rec('every 2 weeks on thu'))).toBe('biweekly');
    expect(kindOf(rec('monthly on 15'))).toBe('monthly');
    expect(kindOf(rec('yearly on 03-14'))).toBe('yearly');
  });

  it('keeps the chip selected whatever day the rule names', () => {
    // The regression this guards: chips used to be matched on exact text, so
    // changing the weekday or day-of-month kicked the picker into "Custom".
    for (const expr of ['weekly on mon', 'weekly on fri', 'weekly on mon,thu', 'weekly']) {
      expect(kindOf(rec(expr)), expr).toBe('weekly');
    }
    for (const expr of ['every 2 weeks on mon', 'every 2 weeks on tue,sat', 'every 2 weeks']) {
      expect(kindOf(rec(expr)), expr).toBe('biweekly');
    }
    for (const expr of ['monthly on 1', 'monthly on 31', 'monthly on last', 'monthly']) {
      expect(kindOf(rec(expr)), expr).toBe('monthly');
    }
  });

  it('treats a full Mon-Fri week as the Weekdays chip, not Weekly', () => {
    expect(kindOf(rec('weekly on mon,tue,wed,thu,fri'))).toBe('weekdays');
    // One day short is an ordinary weekly rule again.
    expect(kindOf(rec('weekly on mon,tue,wed,thu'))).toBe('weekly');
  });

  it('has no chip for shapes the presets do not cover', () => {
    for (const expr of ['every 3 days', 'every 3 weeks on mon', 'every 6 months on last', 'every 2 years on 12-last']) {
      expect(kindOf(rec(expr)), expr).toBeUndefined();
    }
  });
});

describe('seedFor', () => {
  // 2026-07-30 is a Thursday.
  const DUE = '2026-07-30';

  it('names the due date\'s day so the series cannot drift', () => {
    expect(seedFor('weekly', DUE)).toBe('weekly on thu');
    expect(seedFor('biweekly', DUE)).toBe('every 2 weeks on thu');
    expect(seedFor('monthly', DUE)).toBe('monthly on 30');
    expect(seedFor('yearly', DUE)).toBe('yearly on 07-30');
  });

  it('leaves the day-independent presets bare', () => {
    expect(seedFor('daily', DUE)).toBe('daily');
    expect(seedFor('weekdays', DUE)).toBe('weekdays');
  });

  it('produces canonical text that lands back on its own chip', () => {
    for (const kind of ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly'] as const) {
      const expr = seedFor(kind, DUE);
      expect(formatRecurrence(rec(expr)), expr).toBe(expr);
      expect(kindOf(rec(expr)), expr).toBe(kind);
    }
  });

  it('falls back to today when there is no due date', () => {
    // No clock assertion — just that it yields a usable rule rather than NaN.
    for (const kind of ['weekly', 'biweekly', 'monthly', 'yearly'] as const) {
      const expr = seedFor(kind, '');
      expect(parseRecurrence(expr), expr).toBeDefined();
    }
  });
});
