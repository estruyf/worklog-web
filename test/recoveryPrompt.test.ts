// The two ways an installed app misreported its own state on open: offering to
// "recover" edits that had already reached GitHub, and calling itself offline
// when the connection was fine and something else had gone wrong.
//
// Each `startApp` is a cold start. In an installed PWA that means a new instance
// id too — sessionStorage doesn't outlive the process — and Node having no
// sessionStorage gives these tests exactly that behaviour.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';
import { installFakeIndexedDb, installFakeNavigator, installFakeWindow } from './helpers/fakeIndexedDb';

const configWith = (autoSync: { enabled: boolean; delayMinutes: number }) =>
  JSON.stringify({ hoursPerDay: 8, weekStart: 1, clients: [{ id: 'acme', name: 'Acme Corp' }], autoSync }, null, 2) + '\n';
const CONFIG = configWith({ enabled: true, delayMinutes: 1 });
/** Timed auto-sync happens to clear a false "offline" by itself, on its own clock.
 *  With it off, these tests are about what clears it for everybody else. */
const CONFIG_NO_AUTO_SYNC = configWith({ enabled: false, delayMinutes: 1 });

const ACME = '# Acme Corp\n';
const task = (id: string, title: string) => `## ${title}\n- id: ${id}\n- status: open\n- created: 2026-08-04\n`;
/** A task file the way the serializer writes one. */
const acmeWith = (...tasks: string[]) => `${ACME}\n${tasks.map((t) => t.trimEnd()).join('\n\n')}\n`;

const PERSIST_MS = 800;
const WATCH_MS = 60_000;

let files: Record<string, string>;
let head: string;
let commits: number;
let offline: boolean;
/** When set, every API route answers with this instead of doing its job. */
let failure: { status: number; body: string } | null;
let db: ReturnType<typeof installFakeIndexedDb>;
let win: ReturnType<typeof installFakeWindow>;
let nav: ReturnType<typeof installFakeNavigator>;

async function flush(): Promise<void> {
  for (let i = 0; i < 500; i++) {
    await Promise.resolve();
  }
}

function fakeFetch(input: string, init?: RequestInit): Promise<Response> {
  if (offline) {
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  if (failure) {
    return Promise.resolve(new Response(failure.body, { status: failure.status }));
  }
  const url = new URL(input, 'https://worklog.test');
  if (url.pathname === '/api/head') {
    return Promise.resolve(Response.json({ commitSha: head }));
  }
  if (url.pathname === '/api/load') {
    return Promise.resolve(Response.json({ owner: 'o', repo: 'r', branch: 'main', baseCommitSha: head, text: { ...files }, sha: {} }));
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

async function startApp(): Promise<typeof WorklogStore> {
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  await flush();
  return mod.worklogStore;
}

/** An edit that made it to IndexedDB and no further: the app is closed before the
 *  sync fires. */
async function leaveUnsyncedTask(title: string): Promise<void> {
  const store = await startApp();
  await store.createTask({ title, clientId: 'acme' });
  await vi.advanceTimersByTimeAsync(PERSIST_MS);
  await flush();
}

/** A record some earlier instance left behind: the state a device arrives at this
 *  build in, and what any interrupted cleanup leaves. */
async function plantSnapshot(id: string, savedAt: number, base: string, local: string): Promise<void> {
  const { savePending } = await import('../src/data/pendingStore');
  await savePending({
    key: `o/r/main#${id}`,
    repoKey: 'o/r/main',
    instanceId: id,
    owner: 'o',
    repo: 'r',
    branch: 'main',
    baseCommitSha: 'c0',
    savedAt,
    text: { 'clients/acme.md': local },
    baseText: { 'clients/acme.md': base },
    binary: {},
    dirty: ['clients/acme.md'],
    deleted: [],
  });
}

async function snapshotCount(): Promise<number> {
  const { loadPending } = await import('../src/data/pendingStore');
  return (await loadPending('o/r/main')).length;
}

beforeEach(() => {
  files = { '.worklog/config.json': CONFIG, 'clients/acme.md': '# Acme Corp\n' };
  head = 'c0';
  commits = 0;
  offline = false;
  failure = null;
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

describe('the recovery prompt', () => {
  it('still offers edits that genuinely never reached GitHub', async () => {
    await leaveUnsyncedTask('Never sent');

    const store = await startApp();

    expect(store.getRecovery()?.fileCount).toBe(1);
  });

  it('does not come back after a cached open synced the edits', async () => {
    await startApp();
    offline = true;
    await leaveUnsyncedTask('From the train');

    // Reopened, re-applied from the snapshot without a prompt, and synced.
    const second = await startApp();
    offline = false;
    await second.sync();
    await flush();
    expect(files['clients/acme.md']).toContain('From the train');

    const third = await startApp();
    expect(third.getRecovery()).toBeNull();
    expect(third.hasPending()).toBe(false);
  });

  it('does not come back after a restore was synced', async () => {
    await leaveUnsyncedTask('Restored');

    const second = await startApp();
    await second.restorePending();
    await second.sync();
    await flush();
    expect(files['clients/acme.md']).toContain('Restored');

    const third = await startApp();
    expect(third.getRecovery()).toBeNull();
  });

  // The next two are why a source record is deleted at the moment it is taken over
  // rather than left for the "already on the branch" check to find: once the same
  // record changes again elsewhere, a leftover copy reads as a real conflict, and
  // restoring it would put the old version back over the newer one.
  it('does not come back when a restored edit changed again elsewhere after syncing', async () => {
    await plantSnapshot('old', 1, ACME, acmeWith(task('t_mine', 'First version')));
    const second = await startApp();
    await second.restorePending();
    await second.sync();
    await flush();
    files['clients/acme.md'] = acmeWith(task('t_mine', 'Newer version'));
    head = 'c9';

    const third = await startApp();

    expect(third.getRecovery()).toBeNull();
  });

  it('does not come back when an edit carried by a cached open changed again elsewhere', async () => {
    await startApp();
    await plantSnapshot('old', 1, ACME, acmeWith(task('t_mine', 'First version')));
    offline = true;
    const second = await startApp();
    offline = false;
    await second.sync();
    await flush();
    files['clients/acme.md'] = acmeWith(task('t_mine', 'Newer version'));
    head = 'c9';

    const third = await startApp();

    expect(third.getRecovery()).toBeNull();
  });

  it('keeps its own record when restoring after a reload of the same tab', async () => {
    // Same instance id, so the record just written and the source are one record.
    const store = await startApp();
    await store.createTask({ title: 'Mine', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(PERSIST_MS);
    await flush();
    await store.reload();
    await flush();

    await store.restorePending();
    await flush();

    expect(await snapshotCount()).toBe(1);
  });

  it('keeps a restored snapshot recoverable until it is synced', async () => {
    await leaveUnsyncedTask('Restored, then closed');

    const second = await startApp();
    await second.restorePending();
    await flush();

    // Closed again before any sync: moving the record must not have dropped it.
    const third = await startApp();
    expect(third.getRecovery()?.fileCount).toBe(1);
  });

  it('silently drops a snapshot whose edits are already on the branch', async () => {
    const mine = task('t_mine', 'Already pushed');
    await plantSnapshot('old', 1, ACME, acmeWith(mine));
    // The edit landed, and the branch moved on — which is what earned the prompt
    // its "this branch changed on GitHub" warning.
    files['clients/acme.md'] = acmeWith(mine, task('t_elsewhere', 'Added elsewhere'));
    head = 'c9';

    const store = await startApp();

    expect(store.getRecovery()).toBeNull();
    expect(store.hasPending()).toBe(false);
    expect(await snapshotCount()).toBe(0);
  });

  it('drops one on a cached open too, rather than re-applying it', async () => {
    const mine = task('t_mine', 'Already pushed');
    files['clients/acme.md'] = acmeWith(mine);
    await startApp();
    await plantSnapshot('old', 1, ACME, acmeWith(mine));
    offline = true;

    const store = await startApp();

    expect(store.hasPending()).toBe(false);
    expect(await snapshotCount()).toBe(0);
  });

  it('asks when the same record changed again on the branch', async () => {
    // A conflict is a decision, not a duplicate: their copy isn't ours to delete.
    const mine = task('t_mine', 'Edited here');
    await plantSnapshot('old', 1, ACME, acmeWith(mine));
    files['clients/acme.md'] = acmeWith(task('t_mine', 'Edited there'));
    head = 'c9';

    const store = await startApp();

    expect(store.getRecovery()).not.toBeNull();
  });

  it('keeps a snapshot with even one record the branch lacks', async () => {
    await leaveUnsyncedTask('Only here');
    files['clients/acme.md'] = '# Acme Corp\n\n## Added elsewhere\n- id: t_elsewhere\n- status: open\n- created: 2026-08-04\n';
    head = 'c9';

    const store = await startApp();

    expect(store.getRecovery()?.baseChanged).toBe(true);
    await store.restorePending();
    expect(store.getSnapshot().data?.tasks.map((t) => t.title).sort()).toEqual(['Added elsewhere', 'Only here']);
  });

  it('clears every stale snapshot in one open, without asking once', async () => {
    const mine = task('t_mine', 'Already pushed');
    await plantSnapshot('old1', 1, ACME, acmeWith(mine));
    await plantSnapshot('old2', 2, ACME, acmeWith(mine));
    files['clients/acme.md'] = acmeWith(mine);
    head = 'c9';

    const store = await startApp();

    expect(store.getRecovery()).toBeNull();
    expect(await snapshotCount()).toBe(0);
  });

  it('finds real work behind a newer stale snapshot', async () => {
    const landed = task('t_landed', 'Already pushed');
    const real = task('t_real', 'Never sent');
    await plantSnapshot('real', 1, ACME, acmeWith(real));
    await plantSnapshot('stale', 2, ACME, acmeWith(landed));
    files['clients/acme.md'] = acmeWith(landed);
    head = 'c9';

    const store = await startApp();

    expect(store.getRecovery()?.savedAt).toBe(1);
    await store.restorePending();
    expect(store.getSnapshot().data?.tasks.map((t) => t.title)).toContain('Never sent');
  });

  it('keeps the only copy when the new record cannot be written', async () => {
    const real = task('t_real', 'Never sent');
    await plantSnapshot('old', 1, ACME, acmeWith(real));
    const store = await startApp();
    db.failWrites(true);

    await store.restorePending();
    await flush();

    const { loadPending } = await import('../src/data/pendingStore');
    expect((await loadPending('o/r/main')).map((r) => r.instanceId)).toContain('old');
  });
});

describe('what a failed open reports', () => {
  /** A device that has opened the repo before, so there is a cached branch. */
  async function primed(): Promise<void> {
    await startApp();
  }

  it('calls a network failure offline', async () => {
    await primed();
    offline = true;

    const store = await startApp();

    expect(store.getSnapshot().offline).toBe(true);
    expect(store.getSnapshot().sessionExpired).toBe(false);
  });

  it('does not call a rejected session offline', async () => {
    await primed();
    failure = { status: 401, body: 'GitHub GET /repos/o/r/git/ref/heads/main → 401: {"message":"Bad credentials","documentation_url":"https://docs.github.com/rest"}' };

    const store = await startApp();

    expect(store.isLoaded()).toBe(true);
    expect(store.getSnapshot().data?.clients.map((c) => c.id)).toEqual(['acme']);
    expect(store.getSnapshot().offline).toBe(false);
    expect(store.getSnapshot().sessionExpired).toBe(true);
  });

  it('does not call a server error offline, and says what it was', async () => {
    await primed();
    failure = { status: 502, body: 'GitHub GraphQL blob read failed: no data' };

    const store = await startApp();

    expect(store.getSnapshot().offline).toBe(false);
    expect(store.getSnapshot().sessionExpired).toBe(false);
    expect(store.getSnapshot().syncError).toContain('GraphQL');
  });

  it('flags a session rejected during a Sync press, with a readable message', async () => {
    const store = await startApp();
    failure = { status: 401, body: 'Unauthorized' };
    const toasts: string[] = [];
    store.onToast((t) => t && toasts.push(t.message));

    await store.sync();
    await flush();

    expect(store.getSnapshot().sessionExpired).toBe(true);
    expect(toasts.join()).not.toContain('Unauthorized');
  });

  it('flags a session the background head check finds rejected', async () => {
    const store = await startApp();
    failure = { status: 401, body: 'Unauthorized' };

    await vi.advanceTimersByTimeAsync(WATCH_MS);
    await flush();

    expect(store.getSnapshot().sessionExpired).toBe(true);
  });

  it('clears the flag once GitHub accepts the session again', async () => {
    await primed();
    failure = { status: 401, body: 'Unauthorized' };
    const store = await startApp();
    expect(store.getSnapshot().sessionExpired).toBe(true);

    failure = null;
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    await flush();

    expect(store.getSnapshot().sessionExpired).toBe(false);
  });
});

describe('recovering from a false offline', () => {
  it('stands down when the background check reaches GitHub and no online event ever came', async () => {
    // A cold start while the radio is still waking: the load fails, `navigator.onLine`
    // was true throughout, so there is no transition for an `online` event to mark.
    files['.worklog/config.json'] = CONFIG_NO_AUTO_SYNC;
    await startApp();
    offline = true;
    const store = await startApp();
    expect(store.getSnapshot().offline).toBe(true);

    offline = false;
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    await flush();

    expect(store.getSnapshot().offline).toBe(false);
  });

  it('catches up on commits pushed elsewhere when it does', async () => {
    files['.worklog/config.json'] = CONFIG_NO_AUTO_SYNC;
    await startApp();
    offline = true;
    const store = await startApp();

    offline = false;
    files['clients/acme.md'] = '# Acme Corp\n\n## Added elsewhere\n- id: t_elsewhere\n- status: open\n- created: 2026-08-04\n';
    head = 'c9';
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    await flush();

    expect(store.getSnapshot().data?.tasks.map((t) => t.title)).toContain('Added elsewhere');
  });

  it('pushes waiting edits when it does, even with the browser flag stuck on offline', async () => {
    await startApp();
    offline = true;
    nav.setOnline(false);
    const store = await startApp();
    await store.createTask({ title: 'Waiting', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(PERSIST_MS);
    await flush();

    // GitHub is reachable; the flag never finds out.
    offline = false;
    await vi.advanceTimersByTimeAsync(WATCH_MS);
    await flush();

    expect(files['clients/acme.md']).toContain('Waiting');
    expect(store.getSnapshot().offline).toBe(false);
    expect(store.hasPending()).toBe(false);
  });

  it('stays offline while the check keeps failing', async () => {
    await startApp();
    offline = true;
    const store = await startApp();

    await vi.advanceTimersByTimeAsync(WATCH_MS);
    await flush();

    expect(store.getSnapshot().offline).toBe(true);
  });
});
