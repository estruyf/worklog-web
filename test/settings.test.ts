// The scalar settings in `.worklog/config.json`: what a hand-edited or
// older-version file is read as, and what the service writes back. The whole
// stack is in-memory, so these run the real config → service → config path.
//
// The focus is `defaultTaskSort`, the one setting whose absence has to keep
// meaning something specific: every repo written before it existed has no such
// key, and those lists must not re-order on upgrade.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { updateSettings } from '../src/services/settings';
import { DEFAULT_TASK_SORT, normalizeTaskSort } from '../src/model/taskSort';
import { normalizeCodeTheme } from '../src/model/codeTheme';
import type { DaylogConfig } from '../src/model/types';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 1,
  todosPerPage: 5,
  clients: [{ id: 'acme', name: 'Acme Corp' }],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
  autoSync: { enabled: false, delayMinutes: 5 },
};

let store: Store;
let fm: FileMap;

async function mount(configOverride?: unknown) {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(configOverride ?? CONFIG, null, 2));
  fm.text.set('clients/acme.md', '# Acme Corp\n');
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
}

function config(): Promise<DaylogConfig> {
  return store.ws.loadConfig();
}

/** The `features` block as it lands in the user's repo. */
function writtenFeatures(): unknown {
  return JSON.parse(fm.text.get('.worklog/config.json') ?? '{}').features;
}

/** The value as it actually lands in the user's repo, not as the loader
 *  normalizes it back — a setting that never reaches the file would still read
 *  correctly through `loadConfig`. */
function written(): unknown {
  return JSON.parse(fm.text.get('.worklog/config.json') ?? '{}').defaultTaskSort;
}

beforeEach(() => mount());

describe('normalizeTaskSort', () => {
  it('reads a missing value as the order this app shipped with', () => {
    expect(normalizeTaskSort(undefined)).toEqual({ key: 'created', dir: 'asc' });
    expect(normalizeTaskSort(null)).toEqual(DEFAULT_TASK_SORT);
    expect(normalizeTaskSort('newest')).toEqual(DEFAULT_TASK_SORT);
  });

  it('keeps a valid pair', () => {
    expect(normalizeTaskSort({ key: 'created', dir: 'desc' })).toEqual({ key: 'created', dir: 'desc' });
    expect(normalizeTaskSort({ key: 'priority', dir: 'asc' })).toEqual({ key: 'priority', dir: 'asc' });
  });

  it('falls back per field, so one bad half does not discard the other', () => {
    expect(normalizeTaskSort({ key: 'invented-by-a-newer-version', dir: 'desc' })).toEqual({
      key: 'created',
      dir: 'desc',
    });
    expect(normalizeTaskSort({ key: 'title', dir: 'sideways' })).toEqual({ key: 'title', dir: 'asc' });
  });

  it('never returns the shared default object, since callers edit the result', () => {
    const parsed = normalizeTaskSort(undefined);
    parsed.dir = 'desc';
    expect(DEFAULT_TASK_SORT.dir).toBe('asc');
  });
});

describe('loading defaultTaskSort', () => {
  it('reads a config written before the setting existed as the shipped order', async () => {
    expect((await config()).defaultTaskSort).toEqual({ key: 'created', dir: 'asc' });
  });

  it('reads a saved order back', async () => {
    await mount({ ...CONFIG, defaultTaskSort: { key: 'due', dir: 'desc' } });
    expect((await config()).defaultTaskSort).toEqual({ key: 'due', dir: 'desc' });
  });

  it('survives a hand-edited value rather than failing the whole config', async () => {
    await mount({ ...CONFIG, defaultTaskSort: 'newest first' });
    const loaded = await config();
    expect(loaded.defaultTaskSort).toEqual({ key: 'created', dir: 'asc' });
    // The point of the fallback: the rest of the file still loaded.
    expect(loaded.hoursPerDay).toBe(8);
    expect(loaded.clients).toHaveLength(1);
  });
});

describe('updateSettings', () => {
  it('writes the order into config.json', async () => {
    await updateSettings(store, { defaultTaskSort: { key: 'created', dir: 'desc' } });
    expect(written()).toEqual({ key: 'created', dir: 'desc' });
    expect(store.getConfig().defaultTaskSort).toEqual({ key: 'created', dir: 'desc' });
  });

  it('normalizes on the way out, so config.json can never hold an unreadable order', async () => {
    await updateSettings(store, { defaultTaskSort: { key: 'sideways', dir: 'desc' } as never });
    expect(written()).toEqual({ key: 'created', dir: 'desc' });
  });

  it('leaves the order alone when the save is about another setting', async () => {
    await updateSettings(store, { defaultTaskSort: { key: 'title', dir: 'asc' } });
    await updateSettings(store, { hoursPerDay: 7 });
    expect(written()).toEqual({ key: 'title', dir: 'asc' });
    expect(store.getConfig().hoursPerDay).toBe(7);
  });

  it('adds the key to a config that predates it, without disturbing the rest', async () => {
    await updateSettings(store, { defaultTaskSort: { key: 'due', dir: 'asc' } });
    const raw = JSON.parse(fm.text.get('.worklog/config.json') ?? '{}');
    expect(raw.defaultTaskSort).toEqual({ key: 'due', dir: 'asc' });
    expect(raw.clients).toEqual(CONFIG.clients);
    expect(raw.autoSync.delayMinutes).toBe(5);
  });
});

// Every switch is on by default, and a repo written before one existed has no
// key for it — so absence has to keep meaning "on", the same way an absent
// `defaultTaskSort` has to keep meaning the original order. `checklist` arrived
// last and is the case that proves it for the ones that come after.
const ALL_ON = { attachments: true, prompts: true, checklist: true, lists: true };

describe('feature switches', () => {
  it('reads a config that predates them as all on', async () => {
    expect((await config()).features).toEqual(ALL_ON);
  });

  it('reads a repo with no config.json at all as all on', async () => {
    await mount();
    fm.text.delete('.worklog/config.json');
    expect((await config()).features).toEqual(ALL_ON);
  });

  it('reads a config written before lists existed as having them on', async () => {
    await mount({ ...CONFIG, features: { attachments: false, prompts: false } });
    expect((await config()).features).toEqual({ attachments: false, prompts: false, checklist: true, lists: true });
  });

  it('reads a config written before task checklists existed as having them on', async () => {
    await mount({ ...CONFIG, features: { attachments: false, prompts: false, lists: false } });
    expect((await config()).features).toEqual({ attachments: false, prompts: false, checklist: true, lists: false });
  });

  it('switches one off only on an explicit false', async () => {
    await mount({ ...CONFIG, features: { attachments: false, prompts: true } });
    expect((await config()).features).toEqual({ ...ALL_ON, attachments: false });

    await mount({ ...CONFIG, features: { lists: false } });
    expect((await config()).features).toEqual({ ...ALL_ON, lists: false });

    // Anything else — a hand-typed string, a half-written block — reads as on
    // rather than quietly hiding a block the user has content in.
    await mount({ ...CONFIG, features: { attachments: 'no' } });
    expect((await config()).features).toEqual(ALL_ON);
  });

  it('writes the switches into config.json', async () => {
    await updateSettings(store, { features: { attachments: false, prompts: false, checklist: false, lists: false } });

    const allOff = { attachments: false, prompts: false, checklist: false, lists: false };
    expect(writtenFeatures()).toEqual(allOff);
    expect(store.getConfig().features).toEqual(allOff);
  });

  it('changes only the keys it is given', async () => {
    await updateSettings(store, { features: { prompts: false } });
    expect(writtenFeatures()).toEqual({ ...ALL_ON, prompts: false });

    await updateSettings(store, { hoursPerDay: 7 });
    expect(writtenFeatures()).toEqual({ ...ALL_ON, prompts: false });
    expect(store.getConfig().hoursPerDay).toBe(7);
  });
});

// The theme fenced code blocks are painted with. Absent means "follow the OS",
// which is what every repo written before the setting existed gets.
describe('code block theme', () => {
  it('reads a config that predates the setting as following the system', async () => {
    expect((await config()).codeTheme).toBe('system');
  });

  it('reads a saved choice back', async () => {
    await mount({ ...CONFIG, codeTheme: 'dark' });
    expect((await config()).codeTheme).toBe('dark');
  });

  it('survives a hand-edited value rather than failing the whole config', async () => {
    await mount({ ...CONFIG, codeTheme: 'demo-time-dark' });
    const loaded = await config();
    expect(loaded.codeTheme).toBe('system');
    expect(loaded.hoursPerDay).toBe(8);
  });

  it('normalizes anything else to the default', () => {
    expect(normalizeCodeTheme(undefined)).toBe('system');
    expect(normalizeCodeTheme('Dark')).toBe('system');
    expect(normalizeCodeTheme('light')).toBe('light');
  });

  it('writes the choice into config.json and leaves it alone on other saves', async () => {
    await updateSettings(store, { codeTheme: 'light' });
    expect(JSON.parse(fm.text.get('.worklog/config.json') ?? '{}').codeTheme).toBe('light');

    await updateSettings(store, { hoursPerDay: 7 });
    expect(store.getConfig().codeTheme).toBe('light');
  });

  it('normalizes on the way out, so config.json can never hold an unreadable theme', async () => {
    await updateSettings(store, { codeTheme: 'solarized' as never });
    expect(JSON.parse(fm.text.get('.worklog/config.json') ?? '{}').codeTheme).toBe('system');
  });
});
