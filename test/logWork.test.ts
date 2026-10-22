// logWork, the service behind the agent CLI. What matters most is idempotence:
// the CLI replays it after a lost push race, so a second identical run must not
// write a second task, a second worked day or a second note.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { logWork } from '../src/services/logWork';

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

## Fix the mobile picker
- id: t_acme01
- status: open
- link: https://github.com/acme/app/issues/12
- created: 2026-07-01

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02
`;

const ARCHIVE_MD = `# Acme Corp — 2026-06

## Old reporting bug
- id: t_acme03
- status: done
- link: https://github.com/acme/app/issues/7
- created: 2026-06-01
- completed: 2026-06-20
`;

let store: Store;
let fm: FileMap;

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', ACME_MD);
  fm.text.set('archive/acme/2026-06.md', ARCHIVE_MD);
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

const DATE = '2026-07-10';

describe('logWork', () => {
  it('finds the task by its link, marks the day worked and adds the note', async () => {
    const r = await logWork(store, {
      clientId: 'acme',
      title: 'Whatever the agent called it',
      link: 'https://github.com/acme/app/issues/12/',
      note: 'Widened the tap targets',
      date: DATE,
    });

    expect(r).toMatchObject({ created: false, markedWorked: true, noteAdded: true });
    expect(r.task.id).toBe('t_acme01');
    expect(r.task.workedOn).toEqual([DATE]);
    expect(r.task.status).toBe('in-progress');
    expect(r.task.notes?.map((n) => n.text)).toEqual(['Widened the tap targets']);
    expect(fm.text.get('clients/acme.md')).toContain(`- worked: ${DATE}`);
  });

  it('changes nothing when the same input runs twice', async () => {
    const input = { clientId: 'acme', title: 'x', link: 'https://github.com/acme/app/issues/12', note: 'Done', date: DATE };
    await logWork(store, input);
    const after = fm.text.get('clients/acme.md');
    fm.clearDirty();

    const r = await logWork(store, input);

    expect(r).toMatchObject({ created: false, markedWorked: false, noteAdded: false });
    expect(fm.dirty.size).toBe(0);
    expect(fm.text.get('clients/acme.md')).toBe(after);
  });

  it('creates the task with its link when nothing matches, and finds it again next run', async () => {
    const input = { clientId: 'acme', title: 'Add dark mode', link: 'https://github.com/acme/app/issues/40', date: DATE };
    const first = await logWork(store, input);
    const second = await logWork(store, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.task.id).toBe(first.task.id);
    expect(second.task.links.map((l) => l.url)).toEqual(['https://github.com/acme/app/issues/40']);
    expect(store.db.openTasksForClient('acme').filter((t) => t.title === 'Add dark mode')).toHaveLength(1);
  });

  it('falls back to an open task of the same title, so a hand-made task is not duplicated', async () => {
    const r = await logWork(store, {
      clientId: 'acme',
      title: 'ship the invoice export',
      link: 'https://github.com/acme/app/issues/99',
      date: DATE,
    });

    expect(r.created).toBe(false);
    expect(r.task.id).toBe('t_acme02');
  });

  it('logs on an archived task found by its link instead of duplicating it', async () => {
    const r = await logWork(store, { clientId: 'acme', title: 'x', link: 'https://github.com/acme/app/issues/7', date: DATE });

    expect(r.created).toBe(false);
    expect(r.task.id).toBe('t_acme03');
    expect(r.task.status).toBe('done');
    expect(fm.text.get('archive/acme/2026-06.md')).toContain(`- worked: ${DATE}`);
  });

  it('adds a second note on the same day when the text differs', async () => {
    await logWork(store, { clientId: 'acme', title: 'x', taskId: 't_acme02', note: 'First pass', date: DATE });
    const r = await logWork(store, { clientId: 'acme', title: 'x', taskId: 't_acme02', note: 'Second pass', date: DATE });

    expect(r.task.notes?.map((n) => n.text)).toEqual(['First pass', 'Second pass']);
  });

  it('rejects an unknown task id and an unknown client', async () => {
    await expect(logWork(store, { clientId: 'acme', title: 'x', taskId: 't_nope00' })).rejects.toThrow(/not found/);
    await expect(logWork(store, { clientId: 'globex', title: 'x' })).rejects.toThrow(/Unknown client/);
  });
});
