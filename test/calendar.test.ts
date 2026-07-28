// Unit tests for the Calendar view's pure period/rollup derivation.

import { describe, it, expect } from 'vitest';
import {
  calendarCells,
  deriveWorkedByClient,
  monthCells,
  periodLabel,
  shiftPeriod,
  startOfWeek,
  weekCells,
} from '../src/ui/utils/calendar';
import type { Task, WorklogEntry } from '../src/model/types';

const MONDAY = 1;
const SUNDAY = 0;

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.id,
    status: 'open',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'clients/acme.md',
    sourceLine: 0,
    ...over,
  };
}

function log(date: string, clientId: string, hours: number): WorklogEntry {
  return { date, clientId, hours, sourceFile: 'worklog/2026-07.md', sourceLine: 0 };
}

const deps = {
  clientName: (id: string) => (id === 'acme' ? 'Acme Corp' : 'Globex'),
  colorOf: (id: string) => (id === 'acme' ? '#111' : '#222'),
};

describe('startOfWeek', () => {
  it('walks back to the configured first day of the week', () => {
    // 2026-07-27 is a Monday.
    expect(startOfWeek('2026-07-27', MONDAY)).toBe('2026-07-27');
    expect(startOfWeek('2026-07-27', SUNDAY)).toBe('2026-07-26');
    expect(startOfWeek('2026-08-02', MONDAY)).toBe('2026-07-27');
  });
});

describe('monthCells', () => {
  it('pads to whole weeks around the month', () => {
    const cells = monthCells('2026-07', MONDAY);
    expect(cells.length % 7).toBe(0);
    // 1 Jul 2026 is a Wednesday: two leading blanks with a Monday week start.
    expect(cells.slice(0, 3)).toEqual([null, null, '2026-07-01']);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells[cells.length - 1]).toBeNull();
  });

  it('shifts the leading blanks with the week start', () => {
    expect(monthCells('2026-07', SUNDAY).slice(0, 4)).toEqual([null, null, null, '2026-07-01']);
  });
});

describe('weekCells', () => {
  it('returns the seven days of the containing week', () => {
    expect(weekCells('2026-07-30', MONDAY)).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });
});

describe('calendarCells', () => {
  it('picks the grid for the mode', () => {
    expect(calendarCells('week', '2026-07-27', MONDAY)).toHaveLength(7);
    expect(calendarCells('month', '2026-07-27', MONDAY).filter(Boolean)).toHaveLength(31);
  });
});

describe('shiftPeriod', () => {
  it('steps weeks by seven days from the week start', () => {
    expect(shiftPeriod('week', '2026-07-30', -1, MONDAY)).toBe('2026-07-20');
    expect(shiftPeriod('week', '2026-07-30', 1, MONDAY)).toBe('2026-08-03');
  });

  it('steps whole months and lands on the 1st, so short months never skip one', () => {
    expect(shiftPeriod('month', '2026-07-27', 1, MONDAY)).toBe('2026-08-01');
    expect(shiftPeriod('month', '2026-01-31', 1, MONDAY)).toBe('2026-02-01');
    expect(shiftPeriod('month', '2026-01-31', -1, MONDAY)).toBe('2025-12-01');
  });
});

describe('periodLabel', () => {
  it('names the month', () => {
    expect(periodLabel('month', '2026-07-27', MONDAY)).toBe('Jul 2026');
  });

  it('names the week, repeating the month or year only when it changes', () => {
    expect(periodLabel('week', '2026-07-22', MONDAY)).toBe('20 – 26 Jul 2026');
    expect(periodLabel('week', '2026-07-30', MONDAY)).toBe('27 Jul – 2 Aug 2026');
    expect(periodLabel('week', '2026-01-01', MONDAY)).toBe('29 Dec 2025 – 4 Jan 2026');
  });
});

describe('deriveWorkedByClient', () => {
  const cells = calendarCells('week', '2026-07-27', MONDAY); // 27 Jul – 2 Aug

  const tasks: Task[] = [
    task({ id: 'in-week', workedOn: ['2026-07-28', '2026-07-30'] }),
    task({ id: 'outside', workedOn: ['2026-07-20'] }),
    task({ id: 'closed', completed: '2026-07-29', status: 'done' }),
    task({ id: 'globex-task', clientIds: ['globex'], workedOn: ['2026-07-31'] }),
    task({ id: 'a-todo', clientIds: ['todos'], workedOn: ['2026-07-28'] }),
  ];

  const worklog: WorklogEntry[] = [
    log('2026-07-27', 'acme', 8),
    log('2026-07-28', 'acme', 4),
    log('2026-07-28', 'globex', 4),
    log('2026-07-20', 'acme', 8), // outside the week
    log('2026-07-29', 'event:vacation', 8),
  ];

  it('buckets logged hours and worked tasks per client, busiest first', () => {
    const groups = deriveWorkedByClient(cells, tasks, worklog, deps);
    expect(groups.map((g) => g.id)).toEqual(['acme', 'globex']);

    const acme = groups[0];
    expect(acme.name).toBe('Acme Corp');
    expect(acme.hours).toBe(12);
    expect(acme.loggedDays).toBe(2);
    expect(acme.items.map((i) => i.id)).toEqual(['in-week', 'closed']);
    expect(acme.items[0].dates).toEqual(['2026-07-28', '2026-07-30']);
  });

  it('counts a completion inside the period as worked, and flags it done', () => {
    const closed = deriveWorkedByClient(cells, tasks, worklog, deps)[0].items.find((i) => i.id === 'closed');
    expect(closed).toMatchObject({ dates: ['2026-07-29'], done: true });
  });

  it('leaves out general to-dos and anything outside the period', () => {
    const groups = deriveWorkedByClient(cells, tasks, worklog, deps);
    expect(groups.some((g) => g.id === 'todos')).toBe(false);
    expect(groups.flatMap((g) => g.items.map((i) => i.id))).not.toContain('outside');
    expect(groups.find((g) => g.id === 'acme')!.hours).toBe(12);
  });

  it('leaves out events, which can never carry tasks', () => {
    const groups = deriveWorkedByClient(cells, tasks, worklog, deps);
    expect(groups.some((g) => g.id.startsWith('event:'))).toBe(false);
    // Their hours stay out of the rollup too, so the total is client work only.
    expect(groups.reduce((sum, g) => sum + g.hours, 0)).toBe(16);
  });

  it('reports nothing when a period holds events only', () => {
    expect(deriveWorkedByClient(cells, [], [log('2026-07-29', 'event:vacation', 8)], deps)).toEqual([]);
  });

  it('keeps a client that was worked on without any logged time', () => {
    const groups = deriveWorkedByClient(cells, [task({ id: 'unlogged', clientIds: ['globex'], workedOn: ['2026-07-28'] })], [], deps);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 'globex', hours: 0, loggedDays: 0 });
  });

  it('reports nothing for an empty period', () => {
    expect(deriveWorkedByClient(calendarCells('week', '2026-06-01', MONDAY), tasks, worklog, deps)).toEqual([]);
  });
});
