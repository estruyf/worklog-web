// Planned work: which open tasks are still ahead, and which horizon each one
// falls under. The bucketing is the part worth pinning — the boundaries are
// sequential ranges, so a horizon the calendar has already passed (the end of the
// month, when today is the 30th) has to fall out empty rather than swallow dates
// that belong to the bucket after it.

import { describe, it, expect } from 'vitest';
import { collectUpcoming, daysUntil, formatDaysUntil, groupUpcoming, isUpcoming } from '../src/model/upcoming';
import type { Task } from '../src/model/types';

function task(fields: Partial<Task> & { id: string }): Task {
  return {
    title: fields.id,
    status: 'open',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'clients/acme.md',
    sourceLine: 0,
    ...fields,
  };
}

/** A Wednesday, early enough in the month that all five horizons are reachable;
 *  the fixtures below are all read against it. */
const TODAY = '2026-08-05';
/** Monday-started weeks, the way the calendar grid is usually configured. */
const MONDAY = 1;

describe('isUpcoming', () => {
  it('flags an open task due after today', () => {
    expect(isUpcoming(task({ id: 't1', due: '2026-08-06' }), TODAY)).toBe(true);
  });

  it('leaves today and the past alone — those are the overdue view’s', () => {
    expect(isUpcoming(task({ id: 't1', due: TODAY }), TODAY)).toBe(false);
    expect(isUpcoming(task({ id: 't2', due: '2026-08-04' }), TODAY)).toBe(false);
  });

  it('ignores tasks without a due date', () => {
    expect(isUpcoming(task({ id: 't1' }), TODAY)).toBe(false);
  });

  it('ignores completed tasks, however far off they were planned', () => {
    expect(isUpcoming(task({ id: 't1', due: '2026-09-01', completed: '2026-08-01' }), TODAY)).toBe(false);
  });

  it('ignores a malformed due date rather than reading it as distant', () => {
    expect(isUpcoming(task({ id: 't1', due: 'someday' }), TODAY)).toBe(false);
    expect(isUpcoming(task({ id: 't2', due: '2026-02-30' }), TODAY)).toBe(false);
  });

  it('reports nothing before the app knows what day it is', () => {
    // Every date sorts after '', so without the guard this would read as "all of
    // it is planned" — the opposite of how the same case falls out for overdue.
    expect(isUpcoming(task({ id: 't1', due: '2026-08-06' }), '')).toBe(false);
  });
});

describe('daysUntil', () => {
  it('counts the days to the due date', () => {
    expect(daysUntil(task({ id: 't1', due: '2026-08-06' }), TODAY)).toBe(1);
    expect(daysUntil(task({ id: 't2', due: '2026-09-04' }), TODAY)).toBe(30);
  });

  it('counts across a DST change without drifting', () => {
    // Europe/Brussels falls back on 2026-10-25.
    expect(daysUntil(task({ id: 't1', due: '2026-10-26' }), '2026-10-24')).toBe(2);
  });

  it('is 0 for anything that isn’t upcoming', () => {
    expect(daysUntil(task({ id: 't1', due: '2026-07-01' }), TODAY)).toBe(0);
    expect(daysUntil(task({ id: 't2' }), TODAY)).toBe(0);
  });
});

describe('formatDaysUntil', () => {
  it('names the wait', () => {
    expect(formatDaysUntil(1)).toBe('Tomorrow');
    expect(formatDaysUntil(4)).toBe('In 4 days');
  });

  it('falls back to today for anything not ahead', () => {
    expect(formatDaysUntil(0)).toBe('Due today');
  });
});

describe('collectUpcoming', () => {
  it('orders soonest first, ties broken by title', () => {
    const tasks = [
      task({ id: 'far', due: '2026-10-01' }),
      task({ id: 'b', title: 'B', due: '2026-08-06' }),
      task({ id: 'a', title: 'A', due: '2026-08-06' }),
      task({ id: 'past', due: '2026-08-01' }),
      task({ id: 'undated' }),
    ];
    expect(collectUpcoming(tasks, TODAY).map((t) => t.id)).toEqual(['a', 'b', 'far']);
  });
});

describe('groupUpcoming', () => {
  it('buckets by horizon and drops the empty ones', () => {
    const tasks = [
      task({ id: 'tomorrow', due: '2026-08-06' }),
      task({ id: 'friday', due: '2026-08-07' }),
      task({ id: 'next-week', due: '2026-08-12' }),
      task({ id: 'later-this-month', due: '2026-08-25' }),
      task({ id: 'someday', due: '2026-11-02' }),
    ];
    const groups = groupUpcoming(tasks, TODAY, MONDAY);
    expect(groups.map((g) => [g.id, g.tasks.map((t) => t.id)])).toEqual([
      ['tomorrow', ['tomorrow']],
      ['week', ['friday']],
      ['next-week', ['next-week']],
      ['month', ['later-this-month']],
      ['later', ['someday']],
    ]);
  });

  it('honours the configured first day of the week', () => {
    // 2026-08-09 is a Sunday: the end of the current week on Monday-started weeks,
    // and part of the next one when weeks begin on Sunday.
    const tasks = [task({ id: 'sunday', due: '2026-08-09' })];
    expect(groupUpcoming(tasks, TODAY, 1)[0].id).toBe('week');
    expect(groupUpcoming(tasks, TODAY, 0)[0].id).toBe('next-week');
  });

  it('leaves the month bucket empty once the fortnight ahead has passed it', () => {
    // From the 25th, everything left in August is already inside "next week", so
    // "later this month" has nothing to claim and must not reach forward for it.
    const tasks = [task({ id: 'september', due: '2026-09-10' })];
    const groups = groupUpcoming(tasks, '2026-08-25', MONDAY);
    expect(groups.map((g) => g.id)).toEqual(['later']);
  });

  it('returns nothing when nothing is planned', () => {
    expect(groupUpcoming([task({ id: 't1', due: '2026-08-01' })], TODAY, MONDAY)).toEqual([]);
  });
});
