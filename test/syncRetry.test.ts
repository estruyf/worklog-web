// What happens to unsynced work when a sync doesn't land.
//
// A commit that fails leaves the files dirty. Nothing else in the store will
// schedule another attempt — `scheduleCommit` only runs off a store change — so
// without a re-arm in `sync`'s `finally`, one offline moment parks the timesheet
// until the user happens to edit again or presses Sync. It fails silently, which
// is the one way a timesheet must not fail.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';

/** Auto-sync on, with the shortest delay the store will honour (1 minute). */
const CONFIG = JSON.stringify(
  {
    hoursPerDay: 8,
    weekStart: 1,
    clients: [{ id: 'acme', name: 'Acme Corp' }],
    autoSync: { enabled: true, delayMinutes: 1 },
  },
  null,
  2,
) + '\n';

const AUTO_SYNC_MS = 60_000;

let files: Record<string, string>;
let head: string;
let commits: number;
/** When set, /api/commit fails the way an offline tab sees it. */
let commitFails: boolean;
let commitAttempts: number;

function fakeFetch(input: string, init?: RequestInit): Promise<Response> {
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
    commitAttempts++;
    if (commitFails) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
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

async function openStore(): Promise<typeof WorklogStore> {
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  return mod.worklogStore;
}

describe('sync retry after a failure', () => {
  beforeEach(() => {
    files = { '.worklog/config.json': CONFIG, 'clients/acme.md': '# Acme Corp\n' };
    head = 'c0';
    commits = 0;
    commitFails = false;
    commitAttempts = 0;
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the changes pending when the commit fails', async () => {
    const store = await openStore();
    commitFails = true;
    await store.createTask({ title: 'Offline task', clientId: 'acme' });

    await store.sync();

    expect(commitAttempts).toBeGreaterThan(0);
    expect(store.hasPending()).toBe(true);
    expect(files['clients/acme.md']).not.toContain('Offline task');
  });

  it('re-arms the auto-sync timer, so the next tick pushes without another edit', async () => {
    const store = await openStore();
    commitFails = true;
    await store.createTask({ title: 'Offline task', clientId: 'acme' });

    await store.sync();
    expect(store.hasPending()).toBe(true);

    // The network comes back. Nothing else touches the store — no edit, no button.
    commitFails = false;
    await vi.advanceTimersByTimeAsync(AUTO_SYNC_MS);

    expect(store.hasPending()).toBe(false);
    expect(files['clients/acme.md']).toContain('Offline task');
  });

  it('keeps retrying while the failure lasts, rather than giving up after one', async () => {
    const store = await openStore();
    commitFails = true;
    await store.createTask({ title: 'Offline task', clientId: 'acme' });

    await store.sync();
    const afterFirst = commitAttempts;

    await vi.advanceTimersByTimeAsync(AUTO_SYNC_MS);
    expect(commitAttempts).toBeGreaterThan(afterFirst);
    const afterSecond = commitAttempts;

    await vi.advanceTimersByTimeAsync(AUTO_SYNC_MS);
    expect(commitAttempts).toBeGreaterThan(afterSecond);
    expect(store.hasPending()).toBe(true);

    // And it still lands once the failure clears.
    commitFails = false;
    await vi.advanceTimersByTimeAsync(AUTO_SYNC_MS);
    expect(store.hasPending()).toBe(false);
    expect(files['clients/acme.md']).toContain('Offline task');
  });

  it('does not auto-retry when auto-sync is switched off', async () => {
    files['.worklog/config.json'] = CONFIG.replace('"enabled": true', '"enabled": false');
    const store = await openStore();
    commitFails = true;
    await store.createTask({ title: 'Manual task', clientId: 'acme' });

    await store.sync();
    const afterManual = commitAttempts;

    // Auto-sync is off, so a failed manual sync stays the user's move to repeat.
    commitFails = false;
    await vi.advanceTimersByTimeAsync(AUTO_SYNC_MS * 3);

    expect(commitAttempts).toBe(afterManual);
    expect(store.hasPending()).toBe(true);
  });
});

describe('an edit made while a sync is in flight', () => {
  beforeEach(() => {
    files = { '.worklog/config.json': CONFIG, 'clients/acme.md': '# Acme Corp\n' };
    head = 'c0';
    commits = 0;
    commitFails = false;
    commitAttempts = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('still reaches GitHub eventually', async () => {
    // Hold the commit response open so the second edit provably lands *after* the
    // payload was built and while the request is still out — the way a click during
    // a slow push does. Waiting on `entered` rather than counting microtasks is what
    // makes this the mid-flight case and not an edit that merely rode along.
    let release!: () => void;
    let entered!: () => void;
    const inFlight = new Promise<void>((r) => {
      release = r;
    });
    const commitStarted = new Promise<void>((r) => {
      entered = r;
    });
    let holdCommit = false;

    vi.stubGlobal('fetch', ((input: string, init?: RequestInit) => {
      const url = new URL(input, 'https://worklog.test');
      if (url.pathname === '/api/commit' && holdCommit) {
        holdCommit = false;
        // The payload is already serialized into `init.body` by this point.
        entered();
        return inFlight.then(() => fakeFetch(input, init));
      }
      return fakeFetch(input, init);
    }) as unknown as typeof fetch);

    const store = await openStore();
    await store.createTask({ title: 'First task', clientId: 'acme' });

    holdCommit = true;
    const syncing = store.sync();
    await commitStarted;

    // The user keeps working while the push is out.
    await store.createTask({ title: 'Second task', clientId: 'acme' });
    release();
    await syncing;

    // Whatever the first commit carried, the second task must not be stranded:
    // either it is already on the branch, or a timer is coming for it.
    await vi.advanceTimersByTimeAsync(AUTO_SYNC_MS * 2);

    expect(files['clients/acme.md']).toContain('First task');
    expect(files['clients/acme.md']).toContain('Second task');
    expect(store.hasPending()).toBe(false);
  });
});
