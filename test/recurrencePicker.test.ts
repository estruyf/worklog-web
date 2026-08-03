// The recurrence picker's pure decisions: which preset chip a rule belongs to,
// what expression a chip starts from, and how a rule follows its start date. All
// are easy to get subtly wrong — matching a preset by its exact text drops every
// edited rule into "Custom", a preset that names no day lets the series drift,
// and a rule that ignores the start date repeats on the day the chip was clicked.

import { describe, it, expect } from 'vitest';
import { kindOf, retargetToStart, seedFor } from '../src/model/recurrencePresets';
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

describe('retargetToStart', () => {
  const move = (expr: string, start: string): string => formatRecurrence(retargetToStart(rec(expr), start));

  it('moves the day a preset read off the old start date', () => {
    // The reported bug: "Yearly" picked on 2026-08-03, start then set to
    // October 1st. The first occurrence honoured the start date and every one
    // after it landed on August 3rd.
    expect(move('yearly on 08-03', '2026-10-01')).toBe('yearly on 10-01');
    expect(move('monthly on 3', '2026-10-01')).toBe('monthly on 1');
    // 2026-10-01 is a Thursday, 2026-08-03 a Monday.
    expect(move('weekly on mon', '2026-10-01')).toBe('weekly on thu');
    expect(move('every 2 weeks on mon', '2026-10-01')).toBe('every 2 weeks on thu');
  });

  it('leaves choices made in their own control alone', () => {
    // A second weekday and a month end are picked deliberately; neither is an
    // echo of the start date, so neither follows it.
    expect(move('weekly on mon,thu', '2026-10-01')).toBe('weekly on mon,thu');
    expect(move('weekdays', '2026-10-01')).toBe('weekdays');
    expect(move('monthly on last', '2026-10-01')).toBe('monthly on last');
    expect(move('yearly on 03-last', '2026-10-01')).toBe('yearly on 03-last');
  });

  it('has nothing to move for rules that name no day', () => {
    expect(move('daily', '2026-10-01')).toBe('daily');
    expect(move('every 3 days', '2026-10-01')).toBe('every 3 days');
    expect(move('monthly', '2026-10-01')).toBe('monthly');
  });

  it('keeps the rule when the start date is cleared or unparseable', () => {
    for (const start of ['', 'someday', '2026-13-01']) {
      expect(move('yearly on 08-03', start), start).toBe('yearly on 08-03');
    }
  });

  it('preserves everything the start date does not decide', () => {
    const source = { ...rec('every 2 weeks on mon'), anchor: 'completion' as const, until: '2027-01-01' };
    const moved = retargetToStart(source, '2026-10-01');
    expect(moved).toEqual({ ...source, weekdays: [4] });
  });

  it('agrees with the seed for the date it is retargeted to', () => {
    // Either order of edits — chip then date, or date then chip — has to end on
    // the same rule, or the picker contradicts itself.
    const START = '2026-10-01';
    for (const kind of ['weekly', 'biweekly', 'monthly', 'yearly'] as const) {
      const seeded = seedFor(kind, '2026-08-03');
      expect(move(seeded, START), kind).toBe(seedFor(kind, START));
    }
  });
});
