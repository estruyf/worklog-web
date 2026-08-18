// Capturing an idea with no connection, and getting it to GitHub later.
//
// The scenario these cover end to end: the app has been opened on this device
// before, it is opened again offline (a cold start — the tab is gone), a task is
// added, and the connection comes back. Nothing in that sequence may lose the
// task, and none of it may report failure at the user for something that isn't
// one.
//
// The two halves of what the device holds are deliberately separate — the cached
// branch (`repoCache`) and the unsynced edits (`pendingStore`) — so the tests
// exercise them layered, which is the only way they are ever used.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';
import { installFakeIndexedDb, installFakeNavigator, installFakeWindow } from './helpers/fakeIndexedDb';

const CONFIG = (autoSync: string) =>
  JSON.stringify(
    {
      hoursPerDay: 8,
      weekStart: 1,
      clients: [{ id: 'acme', name: 'Acme Corp' }],
      autoSync: JSON.parse(autoSync),
    },
    null,
    2,
  ) + '\n';

const AUTO_ON = '{"enabled":true,"delayMinutes":1}';
const AUTO_OFF = '{"enabled":false,"delayMinutes":1}';

/** The store's own debounce before dirty files reach IndexedDB. */
const PERSIST_MS = 800;

let files: Record<string, string>;
let head: string;
let commits: number;
let offline: boolean;
let db: ReturnType<typeof installFakeIndexedDb>;
let win: ReturnType<typeof installFakeWindow>;
let nav: ReturnType<typeof installFakeNavigator>;

/** Let every queued microtask run: the IndexedDB fake, the already-resolved
 *  fetches, and the per-file awaits of a re-parse. Generous on purpose — these
 *  are microtasks, so the count costs nothing and a short one would make the
 *  tests flaky against a re-parse of a bigger fixture. */
async function flush(): Promise<void> {
  for (let i = 0; i < 500; i++) {
    await Promise.resolve();
  }
}

function fakeFetch(input: string, init?: RequestInit): Promise<Response> {
  if (offline) {
    // What the browser gives you with no connection, on every route alike.
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  const url = new URL(input, 'https://worklog.test');
  if (url.pathname === '/api/head') {
    return Promise.resolve(Response.json({ commitSha: head }));
  }
  if (url.pathname === '/api/load') {
    return Promise.resolve(
      Response.json({ owner: 'o', repo: 'r', branch: 'main', baseCommitSha: head, text: { ...files }, sha: {} }),
    );
  }
  if (url.pathname === '/api/commit') {
    const body = JSON.parse(String(init?.body)) as { files: { path: string; content?: string; deleted?: boolean }[] };
    for (const f of body.files) {
      if (f.deleted) {
        delete files[f.path];
      } else {
        files[f.path] = f.content ?? '';
      }
    }
    head = `c${++commits}`;
    return Promise.resolve(Response.json({ commitSha: head, branch: 'main' }));
  }
  throw new Error(`unexpected fetch: ${input}`);
}

/** Start the app fresh, the way reopening it on this device does: a new store
 *  instance over the storage the previous one left behind. */
async function startApp(): Promise<typeof WorklogStore> {
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  await flush();
  return mod.worklogStore;
}

describe('working offline', () => {
  beforeEach(() => {
    files = { '.worklog/config.json': CONFIG(AUTO_ON), 'clients/acme.md': '# Acme Corp\n' };
    head = 'c0';
    commits = 0;
    offline = false;
    db = installFakeIndexedDb();
    win = installFakeWindow();
    nav = installFakeNavigator();
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    db.reset();
    win.reset();
  });

  /** Take the app offline the way a browser reports it: the flag and the event. */
  function goOffline(): void {
    offline = true;
    nav.setOnline(false);
    win.dispatch('offline');
  }

  function goOnline(): void {
    offline = false;
    nav.setOnline(true);
    win.dispatch('online');
  }

  it('opens from the cached branch when the load fails', async () => {
    await startApp();

    goOffline();
    const store = await startApp();

    expect(store.isLoaded()).toBe(true);
    expect(store.getSnapshot().offline).toBe(true);
    expect(store.getSnapshot().data?.clients.map((c) => c.id)).toEqual(['acme']);
  });

  it('still fails when this device has never opened the repo', async () => {
    // Nothing cached: there is no honest way to show a timesheet, so the error
    // screen is the right answer rather than an empty one that looks real.
    goOffline();
    vi.resetModules();
    const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');

    await expect(mod.worklogStore.open('o', 'r', 'main')).rejects.toThrow();
    expect(mod.worklogStore.isLoaded()).toBe(false);
  });

  it('keeps a task added offline, and pushes it when the connection returns', async () => {
    await startApp();

    goOffline();
    const store = await startApp();
    await store.createTask({ title: 'Idea from the train', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(PERSIST_MS);
    await flush();

    expect(store.hasPending()).toBe(true);
    expect(files['clients/acme.md']).not.toContain('Idea from the train');

    goOnline();
    await flush();

    expect(files['clients/acme.md']).toContain('Idea from the train');
    expect(store.hasPending()).toBe(false);
    expect(store.getSnapshot().offline).toBe(false);
  });

  it('carries an unsynced task across a second offline open', async () => {
    await startApp();

    goOffline();
    const first = await startApp();
    await first.createTask({ title: 'Idea from the train', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(PERSIST_MS);
    await flush();

    // The tab is closed and the app opened again, still with no connection. The
    // task is part of the timesheet now, not a question to answer first.
    const second = await startApp();

    expect(second.getSnapshot().data?.tasks.map((t) => t.title)).toContain('Idea from the train');
    expect(second.getRecovery()).toBeNull();
    expect(second.hasPending()).toBe(true);
  });

  it('counts the files still waiting, for the standing reminder to be specific', async () => {
    await startApp();
    goOffline();
    const store = await startApp();

    expect(store.getSnapshot().pendingCount).toBe(0);

    await store.createTask({ title: 'Idea from the train', clientId: 'acme' });
    await flush();
    // One task and one time entry are two files, and the reminder says which.
    await store.setWorklog('2026-08-04', 'acme', 2);
    await flush();
    expect(store.getSnapshot().pendingCount).toBe(2);

    goOnline();
    await flush();
    expect(store.getSnapshot().pendingCount).toBe(0);
  });

  it('reports being offline as a state, not as a failed sync', async () => {
    await startApp();
    goOffline();
    const store = await startApp();

    const toasts: string[] = [];
    store.onToast((t) => t && toasts.push(`${t.tone}: ${t.message}`));

    await store.createTask({ title: 'Idea from the train', clientId: 'acme' });
    await store.sync();
    await vi.advanceTimersByTimeAsync(PERSIST_MS);
    await flush();

    expect(toasts.filter((t) => t.startsWith('error:'))).toEqual([]);
    expect(store.getSnapshot().offline).toBe(true);
    expect(store.hasPending()).toBe(true);
  });

  it('does not push on reconnect when automatic sync is off', async () => {
    // Reopening offline must not become a way for edits to leave unprompted —
    // "nothing syncs unless I press Sync" has to survive it.
    files['.worklog/config.json'] = CONFIG(AUTO_OFF);
    await startApp();

    goOffline();
    const store = await startApp();
    await store.createTask({ title: 'Mine to send', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(PERSIST_MS);
    await flush();

    goOnline();
    await flush();

    expect(files['clients/acme.md']).not.toContain('Mine to send');
    expect(store.hasPending()).toBe(true);

    // And the Sync button still works, because that is the user asking.
    await store.sync();
    await flush();
    expect(files['clients/acme.md']).toContain('Mine to send');
  });

  it('picks up commits pushed elsewhere once the connection is back', async () => {
    await startApp();

    goOffline();
    const store = await startApp();

    // Another device pushed while this one was away, so what opened from cache is
    // a commit behind — reconnecting has to notice without an edit to carry it.
    files['clients/acme.md'] = '# Acme Corp\n\n## Added elsewhere\n- id: t_elsewhere\n- status: open\n- created: 2026-08-04\n';
    head = 'c9';

    goOnline();
    await flush();

    expect(store.getSnapshot().data?.tasks.map((t) => t.title)).toContain('Added elsewhere');
  });
});
