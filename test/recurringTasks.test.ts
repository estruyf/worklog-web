// Integration tests for recurring tasks: completing one rolls it onto its next
// occurrence instead of archiving it, leaving a snapshot behind as history. The
// whole stack is in-memory, so these run the real markdown → indexer → db path
// and assert on the files that actually get written.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { closeTaskById, setTaskStatus, setTaskRecurrence, updateTask } from '../src/services/taskOps';
import { createTask } from '../src/services/tasks';
import { parseTaskFile } from '../src/parser/taskParser';
import { addMonths, today, weekdayOf } from '../src/util/date';
import { dueOn } from '../src/ui/utils/task';
import type { Task } from '../src/model/types';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [{ id: 'acme', name: 'Acme Corp' }],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
  autoSync: { enabled: false, delayMinutes: 5 },
};

// A weekly Mon/Thu to-do, a cadence to-do measured from completion, a bounded
// series about to run out, and a plain one-off as the control.
const TODOS_MD = `# To-dos

## Water the office plants
- id: t_water
- status: in-progress
- created: 2026-06-01
- due: 2026-07-30
- repeat: weekly on mon,thu
- lastDone: 2026-07-27

The big fern needs more than the rest.

### Notes
- 2026-07-27 10:00 — The fern is looking rough.

## Deep clean the keyboard
- id: t_clean
- status: open
- created: 2026-05-12
- due: 2026-08-04
- repeat: every 30 days
- repeatFrom: completion

## Wrap up the pilot check-in
- id: t_pilot
- status: open
- created: 2026-06-01
- due: 2026-07-29
- repeat: weekly on wed
- repeatUntil: 2026-07-31

## Book the dentist
- id: t_dentist
- status: open
- created: 2026-07-20
- due: 2026-07-30
`;

let store: Store;
let fm: FileMap;

const todosFile = (): string => fm.text.get('clients/todos.md') ?? '';
const archiveFile = (month = '2026-07'): string => fm.text.get(`archive/todos/${month}.md`) ?? '';

/** Parse a task straight out of the on-disk client file, bypassing the db. */
function fromFile(id: string): Task | undefined {
  return parseTaskFile(todosFile(), 'clients/todos.md', 'todos').tasks.find((t) => t.id === id);
}

function archivedOccurrences(templateId: string, month = '2026-07'): Task[] {
  return parseTaskFile(archiveFile(month), `archive/todos/${month}.md`, 'todos').tasks.filter(
    (t) => t.repeatOf === templateId,
  );
}

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/todos.md', TODOS_MD);
  fm.text.set('clients/acme.md', '# Acme Corp\n');
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

describe('completing a recurring task', () => {
  it('keeps it in the client file with its due date advanced', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');

    const live = fromFile('t_water');
    expect(live).toBeDefined();
    expect(live!.completed).toBeUndefined();
    // 2026-07-30 is a Thursday; the next Mon/Thu occurrence is the Monday after.
    expect(live!.due).toBe('2026-08-03');
    expect(live!.lastDone).toBe('2026-07-30');
    expect(live!.repeat).toMatchObject({ unit: 'week', weekdays: [1, 4] });
    // Still open in the db, so it keeps showing up in the to-do list.
    expect(store.db.getTask('t_water')?.completed).toBeUndefined();
  });

  it('resets the status so the next occurrence starts fresh', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');

    expect(fromFile('t_water')!.status).toBe('open');
  });

  it('archives a snapshot of the occurrence under a fresh id', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');

    const occurrences = archivedOccurrences('t_water');
    expect(occurrences).toHaveLength(1);
    const snapshot = occurrences[0];
    expect(snapshot.completed).toBe('2026-07-30');
    expect(snapshot.status).toBe('done');
    expect(snapshot.due).toBe('2026-07-30');
    expect(snapshot.title).toBe('Water the office plants');
    // A fresh id: reusing the live task's would put two blocks with the same id
    // in the index and make every lookup by id ambiguous.
    expect(snapshot.id).not.toBe('t_water');
    expect(snapshot.repeat).toBeUndefined();
  });

  it('leaves no duplicate ids in the index', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');
    await closeTaskById(store, 't_water', '2026-08-03');

    const ids = store.db.getAllTasks().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('moves the occurrence notes into the snapshot and starts the next one clean', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');

    // Otherwise a daily task would carry its whole history forever and re-copy
    // it into the archive on every completion.
    expect(fromFile('t_water')!.notes).toBeUndefined();
    expect(archivedOccurrences('t_water')[0].notes).toEqual([
      { timestamp: '2026-07-27 10:00', text: 'The fern is looking rough.' },
    ]);
    // The description is series-level context, so it stays on both.
    expect(fromFile('t_water')!.description).toContain('The big fern');
    expect(archivedOccurrences('t_water')[0].description).toContain('The big fern');
  });

  it('catches up one occurrence at a time when the series is behind', async () => {
    // Two Mon/Thu slots were missed; each completion advances a single step
    // rather than jumping to today, so the backlog stays visible.
    await closeTaskById(store, 't_water', '2026-08-10');
    expect(fromFile('t_water')!.due).toBe('2026-08-03');

    await closeTaskById(store, 't_water', '2026-08-10');
    expect(fromFile('t_water')!.due).toBe('2026-08-06');
    expect(archivedOccurrences('t_water', '2026-08')).toHaveLength(2);
  });

  it('measures a cadence rule from the completion date, not the due date', async () => {
    await closeTaskById(store, 't_clean', '2026-07-25');

    expect(fromFile('t_clean')!.due).toBe('2026-08-24');
    expect(fromFile('t_clean')!.lastDone).toBe('2026-07-25');
  });

  it('files the snapshot under the month it was completed in', async () => {
    await closeTaskById(store, 't_water', '2026-08-03');

    expect(archiveFile('2026-07')).toBe('');
    expect(archivedOccurrences('t_water', '2026-08')).toHaveLength(1);
  });

  it('closes for good once the series passes its until date', async () => {
    // The next Wednesday after 2026-07-29 is 2026-08-05, past repeatUntil.
    await closeTaskById(store, 't_pilot', '2026-07-29');

    expect(fromFile('t_pilot')).toBeUndefined();
    const archived = parseTaskFile(archiveFile(), 'archive/todos/2026-07.md', 'todos').tasks.find(
      (t) => t.id === 't_pilot',
    );
    expect(archived?.completed).toBe('2026-07-29');
    // Closed for real, not rolled: it keeps its own id and gains no repeatOf.
    expect(archived?.repeatOf).toBeUndefined();
  });

  it('still archives a non-recurring task the old way', async () => {
    await closeTaskById(store, 't_dentist', '2026-07-30');

    expect(fromFile('t_dentist')).toBeUndefined();
    expect(store.db.getTask('t_dentist')?.completed).toBe('2026-07-30');
  });
});

describe('reopening an archived occurrence', () => {
  it('undoes the completion instead of creating a duplicate', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');
    const snapshot = archivedOccurrences('t_water')[0];

    await setTaskStatus(store, snapshot.id, 'open');

    // The snapshot is gone from the archive and nothing was added alongside the
    // live task — there is still exactly one "Water the office plants".
    expect(archivedOccurrences('t_water')).toHaveLength(0);
    const live = fromFile('t_water');
    expect(live!.due).toBe('2026-07-30');
    expect(live!.status).toBe('open');
    expect(live!.notes).toHaveLength(1);
    expect(
      parseTaskFile(todosFile(), 'clients/todos.md', 'todos').tasks.filter(
        (t) => t.title === 'Water the office plants',
      ),
    ).toHaveLength(1);
  });

  it('winds lastDone back to the completion before it', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');
    await closeTaskById(store, 't_water', '2026-08-03');
    expect(fromFile('t_water')!.lastDone).toBe('2026-08-03');

    const latest = archivedOccurrences('t_water', '2026-08')[0];
    await setTaskStatus(store, latest.id, 'open');

    expect(fromFile('t_water')!.lastDone).toBe('2026-07-30');
    expect(fromFile('t_water')!.due).toBe('2026-08-03');
  });

  it('clears lastDone when the first completion is undone', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');
    const snapshot = archivedOccurrences('t_water')[0];

    await setTaskStatus(store, snapshot.id, 'open');

    expect(fromFile('t_water')!.lastDone).toBeUndefined();
  });
});

describe('dueOn — which day a task belongs to', () => {
  const base: Task = {
    id: 't_x',
    title: 'Water the office plants',
    status: 'open',
    clientIds: ['todos'],
    links: [],
    sourceFile: 'clients/todos.md',
    sourceLine: 0,
  };

  it('matches a plain task on its due date only', () => {
    const plain = { ...base, due: '2026-08-03' };
    expect(dueOn(plain, '2026-08-03')).toBe(true);
    expect(dueOn(plain, '2026-08-04')).toBe(false);
  });

  it('matches a recurring task on every day its rule lands on', () => {
    // The task only stores 2026-08-03 as its due date, but the calendar has to
    // show it on every Mon/Thu from there on.
    const weekly: Task = {
      ...base,
      due: '2026-08-03',
      repeat: { unit: 'week', interval: 1, weekdays: [1, 4], anchor: 'schedule' },
    };
    expect(dueOn(weekly, '2026-08-03')).toBe(true);
    expect(dueOn(weekly, '2026-08-06')).toBe(true);
    expect(dueOn(weekly, '2026-10-05')).toBe(true);
    expect(dueOn(weekly, '2026-08-05')).toBe(false);
    // Nothing before the next occurrence: those are already archived.
    expect(dueOn(weekly, '2026-07-30')).toBe(false);
  });

  it('does not match a task with no due date at all', () => {
    expect(dueOn(base, '2026-08-03')).toBe(false);
  });
});

describe('seeding the start of a series', () => {
  it('seeds a rule that arrives from the file without a due date', async () => {
    // The regression: a task written before this invariant existed, or edited by
    // hand, has a rule and no due date — so it matched no day and was invisible
    // everywhere except the flat to-do list.
    fm.text.set(
      'clients/todos.md',
      `${TODOS_MD}\n## Pay the rent\n- id: t_rent\n- status: open\n- created: 2026-01-15\n- repeat: monthly on 1\n`,
    );
    await store.rebuild('test');

    const seeded = store.db.getTask('t_rent');
    expect(seeded?.due).toBeTruthy();
    expect(seeded!.due!.endsWith('-01')).toBe(true);
    expect(seeded!.due! >= today()).toBe(true);
    // ...and it now lands on the days its rule covers.
    expect(dueOn(seeded!, seeded!.due!)).toBe(true);
    expect(dueOn(seeded!, addMonths(seeded!.due!, 3))).toBe(true);
  });

  it('leaves the file alone until the task is next written', async () => {
    fm.dirty.clear();
    await store.rebuild('test');

    // Seeding is an in-memory repair; rewriting files on load would manufacture
    // a commit the user never asked for.
    expect([...fm.dirty]).toEqual([]);
  });

  // A recurrence rule says how often, not when — without a due date the task
  // has no day to appear on and would sit invisible in the to-do list forever.
  it('gives a new recurring task its first occurrence', async () => {
    const created = await createTask(store, {
      title: 'Submit the timesheet',
      clientId: 'todos',
      repeat: { unit: 'month', interval: 1, monthDay: 1, anchor: 'schedule' },
    });

    expect(created.due).toBeTruthy();
    expect(fromFile(created.id)!.due).toBe(created.due);
    // The 1st of some month, and never in the past.
    expect(created.due!.endsWith('-01')).toBe(true);
    expect(created.due! >= today()).toBe(true);
  });

  it('leaves an explicit due date alone', async () => {
    const created = await createTask(store, {
      title: 'Quarterly review',
      clientId: 'todos',
      due: '2026-09-30',
      repeat: { unit: 'month', interval: 3, monthDay: 'last', anchor: 'schedule' },
    });

    expect(created.due).toBe('2026-09-30');
  });

  it('does not invent a due date for a one-off', async () => {
    const created = await createTask(store, { title: 'Call the bank', clientId: 'todos' });

    expect(created.due).toBeUndefined();
  });

  it('seeds the date when a rule is added to an existing task', async () => {
    // t_dentist starts with a due date; clear it, then make it repeat.
    await updateTask(store, 't_dentist', { due: '' });
    expect(fromFile('t_dentist')!.due).toBeUndefined();

    await setTaskRecurrence(store, 't_dentist', {
      unit: 'week',
      interval: 1,
      weekdays: [1],
      anchor: 'schedule',
    });

    const due = fromFile('t_dentist')!.due;
    expect(due).toBeTruthy();
    // A Monday, on or after today.
    expect(weekdayOf(due!)).toBe(1);
    expect(due! >= today()).toBe(true);
  });

  it('keeps a recurring task out of the past when its due date is cleared', async () => {
    await updateTask(store, 't_water', { due: '' });

    // Clearing the due date on a repeating task can't leave it unplaced.
    expect(fromFile('t_water')!.due).toBeTruthy();
  });
});

describe('setTaskRecurrence', () => {
  it('turns a plain task into a recurring one', async () => {
    await setTaskRecurrence(store, 't_dentist', {
      unit: 'month',
      interval: 6,
      monthDay: 'last',
      anchor: 'schedule',
    });

    expect(todosFile()).toContain('- repeat: every 6 months on last');

    // The task was due 2026-07-30, which is off the new series: the end of that
    // same month is still ahead of it, so it becomes the first occurrence.
    await closeTaskById(store, 't_dentist', '2026-07-30');
    expect(fromFile('t_dentist')!.due).toBe('2026-07-31');
    // From there the series steps in proper 6-month strides.
    await closeTaskById(store, 't_dentist', '2026-07-31');
    expect(fromFile('t_dentist')!.due).toBe('2027-01-31');
  });

  it('drops the rule and its bookkeeping, leaving a plain task behind', async () => {
    await setTaskRecurrence(store, 't_water', undefined);

    const live = fromFile('t_water')!;
    expect(live.repeat).toBeUndefined();
    expect(live.lastDone).toBeUndefined();
    expect(live.due).toBe('2026-07-30');

    // From here it closes like any other task.
    await closeTaskById(store, 't_water', '2026-07-30');
    expect(fromFile('t_water')).toBeUndefined();
  });

  it('refuses to make an already-closed task repeat', async () => {
    await closeTaskById(store, 't_dentist', '2026-07-30');

    await expect(
      setTaskRecurrence(store, 't_dentist', { unit: 'day', interval: 1, anchor: 'schedule' }),
    ).rejects.toThrow(/Only open tasks/);
  });
});
