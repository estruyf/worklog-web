// Configurable task statuses: what `normalizeStatuses` guarantees to every
// reader, the service that edits the list, and what removing one leaves behind.
// The whole stack is in-memory, so these run the real config → indexer → db path.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { createTask } from '../src/services/tasks';
import { setTaskStatus } from '../src/services/taskOps';
import { createStatus, deleteStatus, moveStatus, updateStatus } from '../src/services/statuses';
import { normalizeStatuses, openStatusId, orphanStatusIds, terminalStatusId } from '../src/model/status';
import { mergeFile } from '../src/data/merge';
import type { DaylogConfig } from '../src/model/types';

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

const ACME_MD = `# Acme Corp

## Fix the mobile picker
- id: t_acme01
- status: open
- created: 2026-07-01

## Ship the invoice export
- id: t_acme02
- status: in-progress
- created: 2026-07-02
`;

let store: Store;
let fm: FileMap;

async function config(): Promise<DaylogConfig> {
  return store.ws.loadConfig();
}

function statusIds(config: DaylogConfig): string[] {
  return config.statuses.map((s) => s.id);
}

/** What the settings UI computes off the snapshot, over the live store. */
function orphans() {
  return orphanStatusIds(store.getConfig().statuses, store.db.getAllTasks());
}

function usage(id: string): number {
  return store.db.getAllTasks().filter((t) => t.status === id).length;
}

async function mount(configOverride?: unknown) {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(configOverride ?? CONFIG, null, 2));
  fm.text.set('clients/acme.md', ACME_MD);
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
}

beforeEach(() => mount());

describe('normalizeStatuses', () => {
  it('leaves a well-formed list alone', () => {
    expect(normalizeStatuses(CONFIG.statuses)).toEqual([
      { id: 'open', label: 'Open', terminal: undefined, color: undefined },
      { id: 'in-progress', label: 'In progress', terminal: undefined, color: undefined },
      { id: 'done', label: 'Closed', terminal: true, color: undefined },
    ]);
  });

  it('falls back to the defaults for junk, an empty list or a non-array', () => {
    for (const input of [undefined, null, 'nonsense', [], [{ id: '' }, { label: 'No id' }, null]]) {
      expect(normalizeStatuses(input).map((s) => s.id)).toEqual(['open', 'in-progress', 'done']);
    }
  });

  it('drops duplicate ids, keeping the first', () => {
    const out = normalizeStatuses([
      { id: 'open', label: 'Open' },
      { id: 'open', label: 'Also open' },
      { id: 'done', label: 'Closed', terminal: true },
    ]);
    expect(out.map((s) => s.label)).toEqual(['Open', 'Closed']);
  });

  it('reads the last entry as terminal when nothing is flagged — the pre-existing behaviour', () => {
    const out = normalizeStatuses([
      { id: 'open', label: 'Open' },
      { id: 'shipped', label: 'Shipped' },
    ]);
    expect(out.map((s) => [s.id, s.terminal])).toEqual([
      ['open', undefined],
      ['shipped', true],
    ]);
  });

  it('keeps only the first of several terminal flags, and moves it last', () => {
    const out = normalizeStatuses([
      { id: 'done', label: 'Closed', terminal: true },
      { id: 'open', label: 'Open' },
      { id: 'dropped', label: 'Dropped', terminal: true },
    ]);
    expect(out.map((s) => s.id)).toEqual(['open', 'dropped', 'done']);
    expect(out.filter((s) => s.terminal).map((s) => s.id)).toEqual(['done']);
  });

  it('puts a working status back when the closing one is all there is', () => {
    const out = normalizeStatuses([{ id: 'done', label: 'Closed', terminal: true }]);
    expect(out.map((s) => s.id)).toEqual(['open', 'done']);
    expect(openStatusId(out)).toBe('open');
    expect(terminalStatusId(out)).toBe('done');
  });

  it('picks a non-colliding fallback when the only status is named "open"', () => {
    const out = normalizeStatuses([{ id: 'open', label: 'Open', terminal: true }]);
    expect(out.map((s) => s.id)).toEqual(['in-progress', 'open']);
  });

  it('keeps a hex colour and discards anything else', () => {
    const out = normalizeStatuses([
      { id: 'a', label: 'A', color: '#C8860D' },
      { id: 'b', label: 'B', color: 'red' },
      { id: 'c', label: 'C', color: '  #abc ' },
      { id: 'done', label: 'Closed', terminal: true },
    ]);
    expect(out.map((s) => s.color)).toEqual(['#C8860D', undefined, '#abc', undefined]);
  });

  it('trims and caps an over-long label', () => {
    const out = normalizeStatuses([
      { id: 'a', label: '  Waiting for a very long review  ' },
      { id: 'done', label: 'Closed', terminal: true },
    ]);
    expect(out[0].label).toBe('Waiting for a very l');
  });
});

describe('loadConfig', () => {
  it('normalizes what it reads, so a hand-edited list still has exactly one terminal status', async () => {
    await mount({ ...CONFIG, statuses: [{ id: 'todo', label: 'To do' }, { id: 'wip', label: 'WIP' }] });

    const statuses = (await config()).statuses;
    expect(statuses.filter((s) => s.terminal)).toHaveLength(1);
    expect(statuses[statuses.length - 1].terminal).toBe(true);
  });
});

describe('createStatus', () => {
  it('adds a working status directly before the closing one', async () => {
    await createStatus(store, { label: 'Waiting for', color: '#C8860D' });

    expect(statusIds(await config())).toEqual(['open', 'in-progress', 'waiting-for', 'done']);
    expect((await config()).statuses[2]).toMatchObject({ label: 'Waiting for', color: '#C8860D' });
    expect(store.getConfig().statuses.map((s) => s.id)).toContain('waiting-for');
  });

  it('rejects a blank name, an unslugglable one and a duplicate id', async () => {
    await expect(createStatus(store, { label: '   ' })).rejects.toThrow(/name is required/);
    await expect(createStatus(store, { label: '???' })).rejects.toThrow(/lowercase letters/);
    await expect(createStatus(store, { label: 'Open' })).rejects.toThrow(/already exists/);
  });

  it('rejects a name longer than the cap rather than silently truncating it', async () => {
    await expect(createStatus(store, { label: 'Waiting for a very long review' })).rejects.toThrow(/at most 20/);
  });

  it('takes an explicit id, which is how a removed status is put back', async () => {
    await createStatus(store, { label: 'Waiting for', id: 'waiting' });

    expect(statusIds(await config())).toEqual(['open', 'in-progress', 'waiting', 'done']);
  });
});

describe('updateStatus', () => {
  it('renames and recolours without touching the id or any task', async () => {
    await updateStatus(store, 'in-progress', { label: 'Doing', color: '#2D6CDF' });

    expect((await config()).statuses[1]).toMatchObject({ id: 'in-progress', label: 'Doing', color: '#2D6CDF' });
    expect([...fm.dirty]).toEqual(['.worklog/config.json']);
    expect(fm.text.get('clients/acme.md')).toBe(ACME_MD);
  });

  it('can rename the closing status but not un-terminal it', async () => {
    await updateStatus(store, 'done', { label: 'Shipped' });

    const statuses = (await config()).statuses;
    expect(statuses[statuses.length - 1]).toMatchObject({ id: 'done', label: 'Shipped', terminal: true });
  });

  it('drops a colour rather than writing an empty one', async () => {
    await updateStatus(store, 'open', { color: '#6E7781' });
    await updateStatus(store, 'open', { color: '' });

    expect((await config()).statuses[0].color).toBeUndefined();
    expect(fm.text.get('.worklog/config.json')).not.toContain('color');
  });

  it('rejects an unknown status', async () => {
    await expect(updateStatus(store, 'nope', { label: 'X' })).rejects.toThrow(/Unknown status/);
  });
});

describe('moveStatus', () => {
  it('swaps two working statuses', async () => {
    await moveStatus(store, 'in-progress', -1);

    expect(statusIds(await config())).toEqual(['in-progress', 'open', 'done']);
  });

  it('does nothing at either end of the working list', async () => {
    await moveStatus(store, 'open', -1);
    await moveStatus(store, 'in-progress', 1);

    expect(statusIds(await config())).toEqual(['open', 'in-progress', 'done']);
  });

  it('refuses to move the closing status, which is always last', async () => {
    await expect(moveStatus(store, 'done', -1)).rejects.toThrow(/always comes last/);
  });
});

describe('deleteStatus', () => {
  it('drops it from the config and leaves the tasks using it exactly as they were', async () => {
    expect(usage('in-progress')).toBe(1);

    await deleteStatus(store, 'in-progress');

    expect(statusIds(await config())).toEqual(['open', 'done']);
    // The task keeps the id it carries: it lives in the user's Markdown, and
    // reassigning it would be a bulk edit nobody asked for.
    expect(fm.text.get('clients/acme.md')).toBe(ACME_MD);
    expect(store.db.getTask('t_acme02')?.status).toBe('in-progress');
  });

  it('leaves the removed status findable as an orphan, with its count', async () => {
    await deleteStatus(store, 'in-progress');

    expect(orphans()).toEqual([{ id: 'in-progress', count: 1 }]);
  });

  it('stops listing it as an orphan once it is put back', async () => {
    await deleteStatus(store, 'in-progress');
    await createStatus(store, { label: 'In progress', id: 'in-progress' });

    expect(orphans()).toEqual([]);
    expect(statusIds(await config())).toEqual(['open', 'in-progress', 'done']);
  });

  it('refuses the closing status and the last working one', async () => {
    await expect(deleteStatus(store, 'done')).rejects.toThrow(/can't be removed/);
    await deleteStatus(store, 'in-progress');
    await expect(deleteStatus(store, 'open')).rejects.toThrow(/At least one working status/);
  });

  it('rejects an unknown status', async () => {
    await expect(deleteStatus(store, 'nope')).rejects.toThrow(/Unknown status/);
  });
});

describe('tasks against a customized status list', () => {
  it('creates a task in the configured first status, not the literal "open"', async () => {
    await mount({ ...CONFIG, statuses: [{ id: 'inbox', label: 'Inbox' }, { id: 'done', label: 'Closed', terminal: true }] });

    await createTask(store, { title: 'Triage the backlog', clientId: 'acme' });

    const created = store.db.getAllTasks().find((t) => t.title === 'Triage the backlog');
    expect(created?.status).toBe('inbox');
    expect(fm.text.get('clients/acme.md')).toContain('- status: inbox');
  });

  it('moves a task into a custom status in place, without archiving it', async () => {
    await createStatus(store, { label: 'Waiting for' });
    await setTaskStatus(store, 't_acme01', 'waiting-for');

    expect(store.db.getTask('t_acme01')?.status).toBe('waiting-for');
    expect(store.db.getTask('t_acme01')?.completed).toBeUndefined();
    expect(fm.text.get('clients/acme.md')).toContain('- status: waiting-for');
  });

  it('archives on the terminal status even when it has been renamed', async () => {
    await updateStatus(store, 'done', { label: 'Shipped' });
    await setTaskStatus(store, 't_acme01', 'done');

    expect(fm.text.get('clients/acme.md')).not.toContain('t_acme01');
    expect([...fm.text.keys()].some((p) => p.startsWith('archive/acme/'))).toBe(true);
  });
});

describe('merging a status list edited on two devices', () => {
  const CONFIG_PATH = '.worklog/config.json';
  const conf = (statuses: unknown) => JSON.stringify({ ...CONFIG, statuses }, null, 2) + '\n';

  it('keeps a status added on each side', () => {
    const base = conf(CONFIG.statuses);
    const local = conf([...CONFIG.statuses.slice(0, 2), { id: 'waiting', label: 'Waiting' }, CONFIG.statuses[2]]);
    const remote = conf([...CONFIG.statuses.slice(0, 2), { id: 'blocked', label: 'Blocked' }, CONFIG.statuses[2]]);

    const { text, conflicts } = mergeFile(CONFIG_PATH, { base, local, remote });
    const merged = JSON.parse(text!) as DaylogConfig;

    expect(conflicts).toEqual([]);
    expect(merged.statuses.map((s) => s.id).sort()).toEqual(['blocked', 'done', 'in-progress', 'open', 'waiting']);
  });

  it('keeps a removal made on one side only', () => {
    const base = conf(CONFIG.statuses);
    const local = conf([CONFIG.statuses[0], CONFIG.statuses[2]]);

    const { text, conflicts } = mergeFile(CONFIG_PATH, { base, local, remote: base });
    const merged = JSON.parse(text!) as DaylogConfig;

    expect(conflicts).toEqual([]);
    expect(merged.statuses.map((s) => s.id)).toEqual(['open', 'done']);
  });
});
