// editTask, closeTask and listTasks, the services behind the CLI's `update`,
// `done` and `list`. They never create a task, so a pointer that matches nothing
// or several is an error; and, because the CLI replays them after a lost push
// race, a second identical run must change nothing.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { closeTask, editTask } from '../src/services/editTask';
import { listTasks } from '../src/services/listTasks';
import { addTask } from '../src/services/addTask';
import { today } from '../src/util/date';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [
    { id: 'acme', name: 'Acme Corp' },
    { id: 'globex', name: 'Globex' },
  ],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
};

const ACME_MD = `# Acme Corp

## Email the client
- id: t_acme01
- status: open
- priority: high
- link: https://github.com/acme/app/issues/12
- created: 2026-07-01
- due: 2026-11-13
- tags: mail

Ask about the workshop

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02

## Send the monthly invoice reminder
- id: t_acme03
- status: open
- created: 2026-07-03
- due: 2026-07-31
- repeat: monthly on last
`;

const GLOBEX_MD = `# Globex

## Ship the invoice export
- id: t_glob01
- status: open
- created: 2026-07-04
- due: 2026-08-01
`;

let store: Store;
let fm: FileMap;

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', ACME_MD);
  fm.text.set('clients/globex.md', GLOBEX_MD);
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

describe('editTask', () => {
  it('changes only the fields that differ, and reports them', async () => {
    const r = await editTask(store, { taskId: 't_acme01' }, { due: '2026-11-20', priority: 'high', description: 'Ask about the workshop' });

    expect(r.changed).toEqual(['due']);
    expect(r.task.due).toBe('2026-11-20');
    expect(fm.text.get('clients/acme.md')).toContain('- due: 2026-11-20');
  });

  it('clears the due date, the priority and the description', async () => {
    const r = await editTask(store, { taskId: 't_acme01' }, { due: null, priority: 'normal', description: '' });

    expect(r.changed).toEqual(['due', 'priority', 'description']);
    expect(r.task).toMatchObject({ due: undefined, priority: undefined, description: undefined });
  });

  it('adds and removes tags without duplicating one', async () => {
    const r = await editTask(store, { taskId: 't_acme01' }, { addTags: ['Mail', 'client'], removeTags: [] });
    expect(r.task.tags).toEqual(['mail', 'client']);

    const again = await editTask(store, { taskId: 't_acme01' }, { removeTags: ['MAIL'] });
    expect(again.task.tags).toEqual(['client']);
  });

  it('finds the task by link or by title, narrowed by client', async () => {
    const byLink = await editTask(store, { link: 'https://github.com/acme/app/issues/12/' }, { priority: 'urgent' });
    expect(byLink.task.id).toBe('t_acme01');

    const byTitle = await editTask(store, { title: 'ship the invoice export', clientId: 'globex' }, { priority: 'low' });
    expect(byTitle.task.id).toBe('t_glob01');
  });

  it('refuses a title that matches open tasks of two clients, and one that matches nothing', async () => {
    await expect(editTask(store, { title: 'Ship the invoice export' }, { priority: 'low' })).rejects.toThrow(
      /Several open tasks.*t_acme02.*t_glob01/,
    );
    await expect(editTask(store, { title: 'Nope' }, { priority: 'low' })).rejects.toThrow(/No open task/);
  });

  it('changes the status, and refuses one the config does not know', async () => {
    const r = await editTask(store, { taskId: 't_acme02' }, { status: 'in-progress' });
    expect(r.task.status).toBe('in-progress');

    await expect(editTask(store, { taskId: 't_acme02' }, { status: 'blocked' })).rejects.toThrow(/Unknown status/);
  });

  it('moves a task under a parent, and refuses its own subtask as parent', async () => {
    const r = await editTask(store, { taskId: 't_acme02' }, { parentId: 't_acme01' });
    expect(r.task.parentId).toBe('t_acme01');

    await expect(editTask(store, { taskId: 't_acme01' }, { parentId: 't_acme02' })).rejects.toThrow(/its subtasks/);
  });

  it('changes nothing when the same edit runs twice', async () => {
    const edit = { due: '2026-11-20', addTags: ['client'] };
    await editTask(store, { taskId: 't_acme01' }, edit);
    const after = fm.text.get('clients/acme.md');

    const r = await editTask(store, { taskId: 't_acme01' }, edit);

    expect(r.changed).toEqual([]);
    expect(fm.text.get('clients/acme.md')).toBe(after);
  });
});

describe('closeTask', () => {
  it('closes and archives the task, and reports it already closed the second time', async () => {
    const first = await closeTask(store, { title: 'Email the client' });
    expect(first.closed).toBe(true);
    expect(first.task.completed).toBe(today());
    expect(fm.text.get('clients/acme.md')).not.toContain('t_acme01');

    const second = await closeTask(store, { title: 'Email the client' });
    expect(second).toMatchObject({ closed: false, task: { id: 't_acme01' } });
  });

  it('rolls a recurring task on to its next occurrence, once per day', async () => {
    const first = await closeTask(store, { taskId: 't_acme03' });
    expect(first.closed).toBe(true);
    expect(first.task.completed).toBeUndefined();
    expect(first.task.due).not.toBe('2026-07-31');

    const second = await closeTask(store, { taskId: 't_acme03' });
    expect(second.closed).toBe(false);
    expect(second.task.due).toBe(first.task.due);
  });
});

describe('listTasks', () => {
  it('lists open tasks, dated first by due date, and filters by client, due date and tag', async () => {
    await addTask(store, { clientId: 'todos', title: 'Renew the passport', due: '2026-12-01' });

    expect(listTasks(store).map((t) => t.id).slice(0, 3)).toEqual(['t_acme03', 't_glob01', 't_acme01']);
    expect(listTasks(store, { clientId: 'todos' }).map((t) => t.title)).toEqual(['Renew the passport']);
    expect(listTasks(store, { dueBy: '2026-08-01' }).map((t) => t.id)).toEqual(['t_acme03', 't_glob01']);
    expect(listTasks(store, { tag: 'MAIL' }).map((t) => t.id)).toEqual(['t_acme01']);
  });

  it('leaves closed tasks out', async () => {
    await closeTask(store, { taskId: 't_acme01' });

    expect(listTasks(store).map((t) => t.id)).not.toContain('t_acme01');
  });
});
