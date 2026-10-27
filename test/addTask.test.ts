// addTask, the service behind the CLI's `add` command. A to-do is not work done:
// it must carry its date as `due`, never as a worked day, and — because the CLI
// replays it after a lost push race — a second identical run must change nothing.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { addTask } from '../src/services/addTask';
import { GENERAL_TODO_CLIENT_ID } from '../src/model/todos';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [{ id: 'acme', name: 'Acme Corp' }],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
};

const ACME_MD = `# Acme Corp

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02
`;

let store: Store;
let fm: FileMap;

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', ACME_MD);
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

describe('addTask', () => {
  it('creates an open task with its due date, priority and description, and no worked day', async () => {
    const r = await addTask(store, {
      clientId: 'acme',
      title: 'Email the client',
      due: '2026-11-13',
      priority: 'high',
      description: 'About the session and the roundtable',
    });

    expect(r.created).toBe(true);
    expect(r.task).toMatchObject({ status: 'open', due: '2026-11-13', priority: 'high' });
    expect(r.task.workedOn ?? []).toEqual([]);
    expect(r.task.notes ?? []).toEqual([]);
    const md = fm.text.get('clients/acme.md');
    expect(md).toContain('- due: 2026-11-13');
    expect(md).toContain('- priority: high');
    expect(md).toContain('About the session and the roundtable');
    expect(md).not.toContain('- worked:');
    expect(md).not.toContain('### Notes');
  });

  it('changes nothing when the same input runs twice', async () => {
    const input = { clientId: 'acme', title: 'Email the client', due: '2026-11-13' };
    const first = await addTask(store, input);
    const after = fm.text.get('clients/acme.md');
    fm.clearDirty();

    const second = await addTask(store, input);

    expect(second.created).toBe(false);
    expect(second.task.id).toBe(first.task.id);
    expect(fm.dirty.size).toBe(0);
    expect(fm.text.get('clients/acme.md')).toBe(after);
  });

  it('leaves an open task of the same title as it is instead of duplicating it', async () => {
    const r = await addTask(store, { clientId: 'acme', title: 'ship the invoice export', due: '2026-12-01' });

    expect(r.created).toBe(false);
    expect(r.task.id).toBe('t_acme02');
    expect(r.task.due).toBeUndefined();
    expect(fm.dirty.size).toBe(0);
  });

  it('puts a to-do without a client on the general to-do list, creating its file', async () => {
    const r = await addTask(store, { clientId: GENERAL_TODO_CLIENT_ID, title: 'Renew the passport', due: '2026-12-01' });

    expect(r.created).toBe(true);
    expect(r.task.clientIds).toEqual([GENERAL_TODO_CLIENT_ID]);
    expect(r.task.sourceFile).toBe('clients/todos.md');
    expect(fm.text.get('clients/todos.md')).toContain('## Renew the passport');
    expect(fm.text.get('clients/todos.md')).toContain('- due: 2026-12-01');
    expect(fm.text.get('clients/acme.md')).toBe(ACME_MD);
  });

  it('adds tags, and makes it a subtask of an existing parent only', async () => {
    const r = await addTask(store, { clientId: 'acme', title: 'Draft the export spec', tags: ['spec', 'export'], parentId: 't_acme02' });

    expect(r.task).toMatchObject({ tags: ['spec', 'export'], parentId: 't_acme02' });
    await expect(addTask(store, { clientId: 'acme', title: 'Orphan', parentId: 't_nope00' })).rejects.toThrow(/not found/);
  });

  it('rejects an unknown client', async () => {
    await expect(addTask(store, { clientId: 'globex', title: 'x' })).rejects.toThrow(/Unknown client/);
  });
});
