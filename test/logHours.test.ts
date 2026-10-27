// logHours, the service behind the CLI's `hours`, and the rules it shares with
// the day editor (model/worklog). Time is set per client per day, so a second
// identical run must change nothing — the CLI replays it after a lost push race.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { logHours } from '../src/services/logHours';
import { resolveHours, unloggableReason } from '../src/model/worklog';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [
    { id: 'acme', name: 'Acme Corp' },
    { id: 'globex', name: 'Globex' },
    { id: 'initech', name: 'Initech', archived: true },
  ],
};

const OCTOBER = `# Worklog 2026-10

- 2026-10-26 acme 4 — Picker fixes
`;

let store: Store;
let fm: FileMap;

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('worklog/2026-10.md', OCTOBER);
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

describe('resolveHours', () => {
  it('reads full and half days off the working day, and numbers as hours', () => {
    expect(resolveHours('full', 8)).toBe(8);
    expect(resolveHours('half', 7.5)).toBe(3.75);
    expect(resolveHours('2.5', 8)).toBe(2.5);
    expect(resolveHours('3h', 8)).toBe(3);
    expect(resolveHours(0, 8)).toBe(0);
  });

  it('refuses anything else', () => {
    expect(resolveHours('a lot', 8)).toBeUndefined();
    expect(resolveHours('-2', 8)).toBeUndefined();
    expect(resolveHours('', 8)).toBeUndefined();
  });
});

describe('unloggableReason', () => {
  it('allows an active client, and refuses the to-do list, an unknown and an archived one', () => {
    const clients = store.db.getClients();
    expect(unloggableReason(clients, 'acme')).toBeUndefined();
    expect(unloggableReason(clients, 'todos')).toMatch(/no hours/);
    expect(unloggableReason(clients, 'nope')).toMatch(/Unknown client/);
    expect(unloggableReason(clients, 'initech')).toMatch(/archived/);
  });
});

describe('logHours', () => {
  it('adds a line for a client and reports the day total', async () => {
    const r = await logHours(store, { clientId: 'globex', hours: 'half', date: '2026-10-26', note: 'Workshop prep' });

    expect(r).toMatchObject({ hours: 4, changed: true, dayTotal: 8, hoursPerDay: 8, previous: undefined });
    expect(fm.text.get('worklog/2026-10.md')).toContain('- 2026-10-26 globex 4 — Workshop prep');
  });

  it('sets rather than adds, keeping the note when none is given', async () => {
    const r = await logHours(store, { clientId: 'acme', hours: 6, date: '2026-10-26' });

    expect(r).toMatchObject({ hours: 6, changed: true, previous: { hours: 4 } });
    expect(fm.text.get('worklog/2026-10.md')).toContain('- 2026-10-26 acme 6 — Picker fixes');
  });

  it('changes nothing when the same hours run twice', async () => {
    const r = await logHours(store, { clientId: 'acme', hours: '4', date: '2026-10-26' });

    expect(r.changed).toBe(false);
    expect(fm.dirty.size).toBe(0);
  });

  it('removes the line with 0 hours', async () => {
    const r = await logHours(store, { clientId: 'acme', hours: 0, date: '2026-10-26' });

    expect(r).toMatchObject({ changed: true, dayTotal: 0 });
    expect(fm.text.get('worklog/2026-10.md')).not.toContain('2026-10-26 acme');
  });

  it('logs a day event, and creates the month file when it is the first entry', async () => {
    const r = await logHours(store, { event: 'vacation', hours: 'full', date: '2026-11-02' });

    expect(r.target).toBe('event:vacation');
    expect(fm.text.get('worklog/2026-11.md')).toContain('- 2026-11-02 event:vacation 8');
  });

  it('refuses bad input', async () => {
    await expect(logHours(store, { hours: 4 })).rejects.toThrow(/either a client or a day event/);
    await expect(logHours(store, { clientId: 'acme', event: 'sick', hours: 4 })).rejects.toThrow(/either/);
    await expect(logHours(store, { clientId: 'initech', hours: 4 })).rejects.toThrow(/archived/);
    await expect(logHours(store, { event: 'party', hours: 4 })).rejects.toThrow(/Unknown day event/);
    await expect(logHours(store, { clientId: 'acme', hours: 'lots' })).rejects.toThrow(/full, half or a number/);
  });
});
