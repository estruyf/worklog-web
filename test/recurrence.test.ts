// Recurrence rules are pure calendar math, so they get exhaustive unit coverage
// here rather than being exercised only through the services. The two properties
// that matter most: `- repeat:` text round-trips losslessly (diff-clean commits),
// and month-end clamping never drags a series permanently earlier.

import { describe, it, expect } from 'vitest';
import {
  parseRecurrence,
  formatRecurrence,
  describeRecurrence,
  firstOccurrence,
  nextOccurrence,
  nextDueAfterCompletion,
  occursOn,
  type Recurrence,
} from '../src/model/recurrence';
import { addDays } from '../src/util/date';

/** Parse an expression that is expected to be valid. */
function rec(expr: string): Recurrence {
  const parsed = parseRecurrence(expr);
  expect(parsed, `expected "${expr}" to parse`).toBeDefined();
  return parsed!;
}

describe('parseRecurrence', () => {
  it('parses the shorthand forms', () => {
    expect(rec('daily')).toEqual({ unit: 'day', interval: 1, weekdays: undefined, anchor: 'schedule' });
    expect(rec('weekly')).toEqual({ unit: 'week', interval: 1, weekdays: undefined, anchor: 'schedule' });
    expect(rec('monthly')).toEqual({ unit: 'month', interval: 1, weekdays: undefined, anchor: 'schedule' });
    expect(rec('yearly')).toEqual({ unit: 'year', interval: 1, weekdays: undefined, anchor: 'schedule' });
    expect(rec('weekdays').weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses interval forms', () => {
    expect(rec('every 3 days')).toMatchObject({ unit: 'day', interval: 3 });
    expect(rec('every 2 weeks')).toMatchObject({ unit: 'week', interval: 2 });
    expect(rec('every 6 months')).toMatchObject({ unit: 'month', interval: 6 });
    // `every week` is a synonym for `weekly`.
    expect(rec('every week')).toMatchObject({ unit: 'week', interval: 1 });
  });

  it('parses weekday specs in any accepted spelling', () => {
    expect(rec('weekly on mon').weekdays).toEqual([1]);
    expect(rec('weekly on mon,thu').weekdays).toEqual([1, 4]);
    expect(rec('weekly on monday, thursday').weekdays).toEqual([1, 4]);
    // Sorted and de-duplicated regardless of input order.
    expect(rec('weekly on fri,mon,fri').weekdays).toEqual([1, 5]);
    expect(rec('every 2 weeks on thu')).toMatchObject({ interval: 2, weekdays: [4] });
  });

  it('parses month-day and year specs', () => {
    expect(rec('monthly on 15').monthDay).toBe(15);
    expect(rec('monthly on last').monthDay).toBe('last');
    expect(rec('yearly on 03-14')).toMatchObject({ month: 3, monthDay: 14 });
    expect(rec('yearly on 12-last')).toMatchObject({ month: 12, monthDay: 'last' });
  });

  it('is case- and whitespace-insensitive', () => {
    expect(parseRecurrence('  Weekly ON Mon  ')).toMatchObject({ unit: 'week', weekdays: [1] });
  });

  it('rejects anything it does not understand', () => {
    for (const bad of [
      '',
      'sometimes',
      'every 0 days',
      'every -1 days',
      'every 2 fortnights',
      'daily on mon', // daily has nothing to qualify
      'weekly on funday',
      'monthly on 32',
      'monthly on 0',
      'yearly on 13-01',
      'yearly on march',
    ]) {
      expect(parseRecurrence(bad), `expected "${bad}" to be rejected`).toBeUndefined();
    }
  });
});

describe('formatRecurrence', () => {
  const canonical = [
    'daily',
    'every 3 days',
    'weekdays',
    'weekly',
    'weekly on mon,thu',
    'every 2 weeks on thu',
    'monthly',
    'monthly on 15',
    'monthly on last',
    'every 3 months on 1',
    'yearly on 03-14',
    'every 2 years on 12-last',
  ];

  for (const expr of canonical) {
    it(`round-trips "${expr}"`, () => {
      expect(formatRecurrence(rec(expr))).toBe(expr);
      // ...and stays stable on a second pass.
      expect(formatRecurrence(rec(formatRecurrence(rec(expr))))).toBe(expr);
    });
  }

  it('normalises non-canonical input to canonical text', () => {
    expect(formatRecurrence(rec('every day'))).toBe('daily');
    expect(formatRecurrence(rec('weekly on monday,thursday'))).toBe('weekly on mon,thu');
    // Mon-Fri collapses back to the `weekdays` shorthand.
    expect(formatRecurrence(rec('weekly on mon,tue,wed,thu,fri'))).toBe('weekdays');
  });
});

describe('describeRecurrence', () => {
  it('reads as a sentence', () => {
    expect(describeRecurrence(rec('daily'))).toBe('Every day');
    expect(describeRecurrence(rec('weekdays'))).toBe('Every weekday');
    expect(describeRecurrence(rec('every 2 weeks on thu'))).toBe('Every 2 weeks on Thursday');
    expect(describeRecurrence(rec('weekly on mon,wed,fri'))).toBe('Every week on Monday, Wednesday and Friday');
    expect(describeRecurrence(rec('monthly on 15'))).toBe('Every month on the 15th');
    expect(describeRecurrence(rec('monthly on last'))).toBe('Every month on the last day');
    expect(describeRecurrence(rec('monthly on 3'))).toBe('Every month on the 3rd');
    expect(describeRecurrence(rec('yearly on 03-14'))).toBe('Every year on March 14th');
  });

  it('mentions the cadence anchor and end date', () => {
    expect(describeRecurrence({ ...rec('every 10 days'), anchor: 'completion' })).toBe(
      'Every 10 days after completion',
    );
    expect(describeRecurrence({ ...rec('weekly'), until: '2026-12-31' })).toBe('Every week, until 2026-12-31');
  });
});

describe('nextOccurrence — schedule anchor', () => {
  it('steps daily rules', () => {
    expect(nextOccurrence(rec('daily'), '2026-07-28')).toBe('2026-07-29');
    expect(nextOccurrence(rec('every 3 days'), '2026-07-28')).toBe('2026-07-31');
  });

  it('crosses month and year boundaries', () => {
    expect(nextOccurrence(rec('daily'), '2026-07-31')).toBe('2026-08-01');
    expect(nextOccurrence(rec('daily'), '2026-12-31')).toBe('2027-01-01');
    // 2028 is a leap year.
    expect(nextOccurrence(rec('daily'), '2028-02-28')).toBe('2028-02-29');
  });

  it('skips the weekend for weekday rules', () => {
    // 2026-07-31 is a Friday.
    expect(nextOccurrence(rec('weekdays'), '2026-07-31')).toBe('2026-08-03');
    expect(nextOccurrence(rec('weekdays'), '2026-07-30')).toBe('2026-07-31');
  });

  it('walks a multi-day weekly rule', () => {
    // 2026-07-27 is a Monday.
    expect(nextOccurrence(rec('weekly on mon,thu'), '2026-07-27')).toBe('2026-07-30');
    expect(nextOccurrence(rec('weekly on mon,thu'), '2026-07-30')).toBe('2026-08-03');
  });

  it('honours the week interval, not just the weekday', () => {
    // Every other Thursday: the Thursday one week later is skipped.
    expect(nextOccurrence(rec('every 2 weeks on thu'), '2026-07-30')).toBe('2026-08-13');
    expect(nextOccurrence(rec('every 2 weeks'), '2026-07-30')).toBe('2026-08-13');
  });

  it('clamps month-day overflow without dragging the series earlier', () => {
    // The defining property: after Jan 31 clamps to Feb 28, March goes back to
    // the 31st rather than sticking at the 28th.
    const monthly31 = rec('monthly on 31');
    expect(nextOccurrence(monthly31, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(monthly31, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrence(monthly31, '2026-03-31')).toBe('2026-04-30');
  });

  it('tracks the real month end for `on last`', () => {
    const last = rec('monthly on last');
    expect(nextOccurrence(last, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(last, '2026-02-28')).toBe('2026-03-31');
    // Leap year February.
    expect(nextOccurrence(last, '2028-01-31')).toBe('2028-02-29');
  });

  it('steps monthly intervals', () => {
    expect(nextOccurrence(rec('every 3 months on 1'), '2026-07-01')).toBe('2026-10-01');
    expect(nextOccurrence(rec('monthly on 15'), '2026-12-15')).toBe('2027-01-15');
  });

  it('steps yearly rules and clamps Feb 29', () => {
    expect(nextOccurrence(rec('yearly on 03-14'), '2026-03-14')).toBe('2027-03-14');
    expect(nextOccurrence(rec('yearly on 02-29'), '2028-02-29')).toBe('2029-02-28');
    expect(nextOccurrence(rec('every 2 years on 12-last'), '2026-12-31')).toBe('2028-12-31');
  });

  it('treats an off-series base as the phase origin', () => {
    // Due date edited by hand to the 10th: the 15th later that same month is
    // still the next occurrence, not the one a month out.
    expect(nextOccurrence(rec('monthly on 15'), '2026-07-10')).toBe('2026-07-15');
    expect(nextOccurrence(rec('monthly on 15'), '2026-07-20')).toBe('2026-08-15');
  });

  it('catches up one occurrence at a time when a series is behind', () => {
    // Three days missed: each completion advances a single day rather than
    // jumping to today, so the backlog stays visible.
    const daily = rec('daily');
    expect(nextOccurrence(daily, '2026-07-25')).toBe('2026-07-26');
    expect(nextOccurrence(daily, '2026-07-26')).toBe('2026-07-27');
  });

  it('ends the series past its until date', () => {
    const bounded: Recurrence = { ...rec('weekly'), until: '2026-08-05' };
    expect(nextOccurrence(bounded, '2026-07-22')).toBe('2026-07-29');
    // 2026-08-05 is the last occurrence; the one after it falls outside.
    expect(nextOccurrence(bounded, '2026-07-29')).toBe('2026-08-05');
    expect(nextOccurrence(bounded, '2026-08-05')).toBeUndefined();
  });

  it('rejects an unparseable base date', () => {
    expect(nextOccurrence(rec('daily'), 'someday')).toBeUndefined();
    expect(nextOccurrence(rec('daily'), '2026-02-30')).toBeUndefined();
  });
});

describe('nextOccurrence — completion anchor', () => {
  const cadence = (expr: string): Recurrence => ({ ...rec(expr), anchor: 'completion' });

  it('measures the interval from the completion date', () => {
    expect(nextOccurrence(cadence('every 10 days'), '2026-07-25')).toBe('2026-08-04');
    expect(nextOccurrence(cadence('every 3 months'), '2026-07-25')).toBe('2026-10-25');
  });

  it('rolls onto an allowed weekday when the rule names any', () => {
    // 2026-07-25 is a Saturday; +7 days is the following Saturday, which rolls
    // forward to Monday.
    expect(nextOccurrence(cadence('weekdays'), '2026-07-25')).toBe('2026-08-03');
  });
});

describe('occursOn', () => {
  it('matches every occurrence in the series, not just the next one', () => {
    // 2026-08-01 is a Saturday, so the first Mon/Thu after it is the 3rd.
    const weekly = rec('weekly on mon,thu');
    expect(occursOn(weekly, '2026-08-03', '2026-08-03')).toBe(true);
    expect(occursOn(weekly, '2026-08-06', '2026-08-03')).toBe(true);
    expect(occursOn(weekly, '2026-09-07', '2026-08-03')).toBe(true);
    expect(occursOn(weekly, '2026-08-04', '2026-08-03')).toBe(false);
  });

  it('honours the interval, not just the shape of the day', () => {
    const biweekly = rec('every 2 weeks on thu');
    expect(occursOn(biweekly, '2026-08-13', '2026-07-30')).toBe(true);
    // The Thursday in between is in an off week.
    expect(occursOn(biweekly, '2026-08-06', '2026-07-30')).toBe(false);

    const everyThird = rec('every 3 days');
    expect(occursOn(everyThird, '2026-08-02', '2026-07-30')).toBe(true);
    expect(occursOn(everyThird, '2026-08-01', '2026-07-30')).toBe(false);
  });

  it('counts a clamped month end as a hit', () => {
    // "Monthly on 31" resolves to the 28th in February — that day *is* the
    // occurrence, so the day view has to match it.
    const monthly31 = rec('monthly on 31');
    expect(occursOn(monthly31, '2026-02-28', '2026-01-31')).toBe(true);
    expect(occursOn(monthly31, '2026-02-27', '2026-01-31')).toBe(false);
    expect(occursOn(rec('monthly on last'), '2026-04-30', '2026-01-31')).toBe(true);
  });

  it('handles monthly and yearly intervals', () => {
    expect(occursOn(rec('every 3 months on 1'), '2026-10-01', '2026-07-01')).toBe(true);
    expect(occursOn(rec('every 3 months on 1'), '2026-09-01', '2026-07-01')).toBe(false);
    expect(occursOn(rec('yearly on 03-14'), '2029-03-14', '2026-03-14')).toBe(true);
    expect(occursOn(rec('yearly on 03-14'), '2029-03-15', '2026-03-14')).toBe(false);
  });

  it('ignores dates before the next occurrence and after the end', () => {
    const daily = rec('daily');
    // Earlier occurrences are already closed as their own archived blocks.
    expect(occursOn(daily, '2026-07-29', '2026-07-30')).toBe(false);
    expect(occursOn({ ...daily, until: '2026-08-02' }, '2026-08-03', '2026-07-30')).toBe(false);
    expect(occursOn({ ...daily, until: '2026-08-02' }, '2026-08-02', '2026-07-30')).toBe(true);
  });

  it('only confirms the scheduled occurrence for a cadence rule', () => {
    // Where the ones after it land depends on when each is completed.
    const cadence: Recurrence = { ...rec('every 10 days'), anchor: 'completion' };
    expect(occursOn(cadence, '2026-08-04', '2026-08-04')).toBe(true);
    expect(occursOn(cadence, '2026-08-14', '2026-08-04')).toBe(false);
  });

  it('agrees with walking the series forward', () => {
    // The property that matters: whatever nextOccurrence would produce step by
    // step, occursOn recognises — and nothing in between.
    for (const expr of [
      'daily',
      'every 3 days',
      'weekdays',
      'weekly on mon,thu',
      'every 2 weeks on thu',
      'monthly on 31',
      'monthly on last',
      'every 3 months on 1',
    ]) {
      const r = rec(expr);
      const start = '2026-01-31';
      const walked = new Set<string>([start]);
      let cursor = start;
      for (let i = 0; i < 40; i++) {
        const next = nextOccurrence(r, cursor);
        if (!next) {
          break;
        }
        walked.add(next);
        cursor = next;
      }
      // Every day from the start to the last walked occurrence must agree.
      for (let day = start; day <= cursor; day = addDays(day, 1)) {
        expect(occursOn(r, day, start), `${expr} @ ${day}`).toBe(walked.has(day));
      }
    }
  });
});

describe('firstOccurrence', () => {
  it('starts a day-naming rule on its next real slot', () => {
    // Set up mid-month, "monthly on 1" starts on the 1st — not today, and not
    // a month and a day from now.
    expect(firstOccurrence(rec('monthly on 1'), '2026-07-28')).toBe('2026-08-01');
    expect(firstOccurrence(rec('monthly on last'), '2026-07-28')).toBe('2026-07-31');
    // 2026-08-01 is a Saturday.
    expect(firstOccurrence(rec('weekdays'), '2026-08-01')).toBe('2026-08-03');
    expect(firstOccurrence(rec('yearly on 03-14'), '2026-07-28')).toBe('2027-03-14');
  });

  it('counts today itself as the first occurrence when it lands on a slot', () => {
    // The boundary that an "occurrence strictly after today" rule gets wrong:
    // setting up "monthly on 1" on the 1st should start today, not next month.
    expect(firstOccurrence(rec('monthly on 1'), '2026-08-01')).toBe('2026-08-01');
    // 2026-08-03 is a Monday.
    expect(firstOccurrence(rec('weekdays'), '2026-08-03')).toBe('2026-08-03');
    expect(firstOccurrence(rec('weekly on mon,thu'), '2026-08-03')).toBe('2026-08-03');
  });

  it('takes the nearest slot for a multi-interval rule, not one interval out', () => {
    // The phase of "every 3 months on the 1st" — Aug/Nov/Feb or Oct/Jan/Apr — is
    // decided by where the series starts, so the first one is simply the next
    // 1st. Counting the interval from the day it was written instead made the
    // same rule start in October when set up in July and in November in August.
    expect(firstOccurrence(rec('every 3 months on 1'), '2026-07-29')).toBe('2026-08-01');
    expect(firstOccurrence(rec('every 3 months on 1'), '2026-08-29')).toBe('2026-09-01');
    // And from there the interval does apply.
    expect(nextOccurrence(rec('every 3 months on 1'), '2026-08-01')).toBe('2026-11-01');
    // 2026-08-03 is a Monday; a fortnightly rule starts on the coming Monday
    // rather than skipping the one in the "off" week.
    expect(firstOccurrence(rec('every 2 weeks on mon'), '2026-07-28')).toBe('2026-08-03');
    expect(firstOccurrence(rec('every 2 years on 03-14'), '2026-07-28')).toBe('2027-03-14');
  });

  it('starts the series wherever it is told to', () => {
    // A start date the caller picks is the anchor, even when the rule's own
    // choice would have been earlier.
    expect(firstOccurrence(rec('every 3 months on 1'), '2026-10-01')).toBe('2026-10-01');
    expect(firstOccurrence(rec('monthly on 1'), '2027-01-15')).toBe('2027-02-01');
  });

  it('starts a pure-interval rule immediately', () => {
    // "Every 10 days" has no slots of its own — waiting 10 days to start is
    // never what someone means.
    expect(firstOccurrence(rec('daily'), '2026-07-28')).toBe('2026-07-28');
    expect(firstOccurrence(rec('every 10 days'), '2026-07-28')).toBe('2026-07-28');
    expect(firstOccurrence(rec('weekly'), '2026-07-28')).toBe('2026-07-28');
  });

  it('starts a cadence rule immediately too, whatever its anchor', () => {
    const cadence: Recurrence = { ...rec('every 30 days'), anchor: 'completion' };
    expect(firstOccurrence(cadence, '2026-07-28')).toBe('2026-07-28');
  });

  it('yields nothing when the series is already over', () => {
    expect(firstOccurrence({ ...rec('monthly on 1'), until: '2026-07-30' }, '2026-07-28')).toBeUndefined();
    expect(firstOccurrence(rec('daily'), 'not-a-date')).toBeUndefined();
  });
});

describe('nextDueAfterCompletion', () => {
  it('advances schedule rules from the due date, ignoring when the work happened', () => {
    // Due Monday, ticked off late on Wednesday: next is still Tuesday's slot.
    expect(nextDueAfterCompletion(rec('daily'), '2026-07-27', '2026-07-29')).toBe('2026-07-28');
  });

  it('advances cadence rules from the completion date', () => {
    expect(nextDueAfterCompletion(cadenceOf('every 10 days'), '2026-07-20', '2026-07-25')).toBe('2026-08-04');
  });

  it('falls back to the completion date when a schedule rule has no due date', () => {
    expect(nextDueAfterCompletion(rec('daily'), undefined, '2026-07-28')).toBe('2026-07-29');
  });

  function cadenceOf(expr: string): Recurrence {
    return { ...rec(expr), anchor: 'completion' };
  }
});
