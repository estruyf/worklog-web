// Overdue detection. The scenario that matters most is the recurring one: a
// task scheduled for a date nobody works (the 1st falling on a Saturday) has to
// keep showing up until it is actually done, and it can't do that through the
// "due this day" list — a schedule-anchored rule only moves its due date on
// completion, so by Monday no day matches it any more.

import { describe, it, expect } from 'vitest';
import { collectOverdue, daysOverdue, formatDaysLate, isOverdue } from '../src/model/overdue';
import { parseRecurrence } from '../src/model/recurrence';
import { dueOn } from '../src/ui/utils/task';
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

describe('isOverdue', () => {
  it('flags an open task whose due date has passed', () => {
    expect(isOverdue(task({ id: 't1', due: '2026-07-28' }), '2026-07-29')).toBe(true);
  });

  it('leaves today and the future alone', () => {
    expect(isOverdue(task({ id: 't1', due: '2026-07-29' }), '2026-07-29')).toBe(false);
    expect(isOverdue(task({ id: 't2', due: '2026-08-30' }), '2026-07-29')).toBe(false);
  });

  it('ignores tasks without a due date', () => {
    expect(isOverdue(task({ id: 't1' }), '2026-07-29')).toBe(false);
  });

  it('ignores completed tasks, however late they were', () => {
    expect(isOverdue(task({ id: 't1', due: '2026-01-05', completed: '2026-02-01' }), '2026-07-29')).toBe(false);
  });

  it('ignores a malformed due date rather than reading it as ancient', () => {
    expect(isOverdue(task({ id: 't1', due: 'someday' }), '2026-07-29')).toBe(false);
    expect(isOverdue(task({ id: 't2', due: '2026-02-30' }), '2026-07-29')).toBe(false);
  });

  it('reports nothing before the app knows what day it is', () => {
    expect(isOverdue(task({ id: 't1', due: '2026-07-28' }), '')).toBe(false);
  });
});

describe('daysOverdue', () => {
  it('counts the days since the due date', () => {
    expect(daysOverdue(task({ id: 't1', due: '2026-07-28' }), '2026-07-29')).toBe(1);
    expect(daysOverdue(task({ id: 't2', due: '2026-06-29' }), '2026-07-29')).toBe(30);
  });

  it('counts across a DST change without drifting', () => {
    // Europe/Brussels springs forward on 2026-03-29.
    expect(daysOverdue(task({ id: 't1', due: '2026-03-27' }), '2026-03-30')).toBe(3);
  });

  it('is 0 for anything that is not overdue', () => {
    expect(daysOverdue(task({ id: 't1', due: '2026-07-29' }), '2026-07-29')).toBe(0);
    expect(daysOverdue(task({ id: 't2' }), '2026-07-29')).toBe(0);
  });
});

describe('collectOverdue', () => {
  const tasks = [
    task({ id: 'fresh', due: '2026-07-29' }),
    task({ id: 'late-b', title: 'B', due: '2026-07-20' }),
    task({ id: 'oldest', due: '2026-05-02' }),
    task({ id: 'late-a', title: 'A', due: '2026-07-20' }),
    task({ id: 'nodue' }),
    task({ id: 'closed', due: '2026-01-01', completed: '2026-07-10' }),
  ];

  it('returns only the open, past-due tasks, longest overdue first', () => {
    expect(collectOverdue(tasks, '2026-07-29').map((t) => t.id)).toEqual(['oldest', 'late-a', 'late-b']);
  });

  it('ties break on title, so the list order is stable across renders', () => {
    const same = collectOverdue(tasks, '2026-07-29').filter((t) => t.due === '2026-07-20');
    expect(same.map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('is empty when nothing has slipped', () => {
    expect(collectOverdue(tasks, '2026-05-01')).toEqual([]);
  });
});

describe('a monthly task that landed on a weekend', () => {
  // "Invoices on the 1st": 2026-08-01 is a Saturday, so the work happens Monday.
  const invoices = task({
    id: 't_invoice',
    title: 'Send the invoices',
    due: '2026-08-01',
    repeat: parseRecurrence('monthly on 1'),
  });

  it('is not due on the Monday — the rule only lands on the 1st', () => {
    expect(dueOn(invoices, '2026-08-03')).toBe(false);
  });

  it('so the overdue list is what keeps it visible', () => {
    expect(isOverdue(invoices, '2026-08-03')).toBe(true);
    expect(daysOverdue(invoices, '2026-08-03')).toBe(2);
  });

  it('says nothing on the Saturday itself, when it is merely due', () => {
    expect(isOverdue(invoices, '2026-08-01')).toBe(false);
    expect(dueOn(invoices, '2026-08-01')).toBe(true);
  });

  it('stops once the occurrence is completed and the due date rolls on', () => {
    const rolled = { ...invoices, due: '2026-09-01', lastDone: '2026-08-03' };
    expect(isOverdue(rolled, '2026-08-03')).toBe(false);
  });
});

describe('formatDaysLate', () => {
  it('reads as a sentence fragment', () => {
    expect(formatDaysLate(1)).toBe('1 day late');
    expect(formatDaysLate(9)).toBe('9 days late');
    expect(formatDaysLate(0)).toBe('Due today');
  });
});
