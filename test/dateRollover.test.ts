// The date the app thinks it is.
//
// `today` is computed when the state is derived, so a tab left open overnight
// would keep yesterday's date — nothing newly overdue, a recurring task due the
// next day never surfacing, and the day view still calling yesterday "today".
//
// Three things drive the check: the midnight timer, coming back to the tab, and
// refocusing the window. None of them is reliable on its own — a backgrounded tab
// can be frozen outright, and a sleeping machine fires the timer late or not at
// all — so each only asks the same question, and the answer is a date comparison.
// That comparison is the part worth pinning: without it every refocus would
// publish a snapshot and re-render the app for no reason.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CONFIG =
  JSON.stringify(
    {
      hoursPerDay: 8,
      weekStart: 1,
      clients: [{ id: 'acme', name: 'Acme Corp' }],
      // Off, so the only timer in play is the rollover's.
      autoSync: { enabled: false, delayMinutes: 5, events: [] },
    },
    null,
    2,
  ) + '\n';

let files: Record<string, string>;
let commitAttempts: number;

function fakeFetch(input: string): Promise<Response> {
  const url = new URL(input, 'https://worklog.test');
  if (url.pathname === '/api/head') {
    return Promise.resolve(Response.json({ commitSha: 'c0' }));
  }
  if (url.pathname === '/api/load') {
    return Promise.resolve(
      Response.json({ owner: 'o', repo: 'r', branch: 'main', baseCommitSha: 'c0', text: { ...files }, binary: {}, sha: {} }),
    );
  }
  if (url.pathname === '/api/commit') {
    commitAttempts++;
    return Promise.resolve(Response.json({ commitSha: 'c1', branch: 'main' }));
  }
  throw new Error(`unexpected fetch: ${input}`);
}

/** Just enough `window` and `document` for the store to register the listeners it
 *  registers in a browser, and for the test to fire them. Must be in place before
 *  the module is imported: the store is a singleton that subscribes on construction. */
function installBrowser() {
  const listeners = new Map<string, Array<() => void>>();
  const addEventListener = (type: string, listener: () => void) => {
    listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  };
  vi.stubGlobal('window', { addEventListener, removeEventListener() {} });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener, removeEventListener() {} });
  return { fire: (type: string) => listeners.get(type)?.forEach((l) => l()) };
}

async function openStore() {
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  return mod.worklogStore;
}

const HOUR = 60 * 60_000;

describe('rolling over to a new day', () => {
  let browser: ReturnType<typeof installBrowser>;

  beforeEach(() => {
    files = { '.worklog/config.json': CONFIG, 'clients/acme.md': '# Acme Corp\n' };
    commitAttempts = 0;
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    browser = installBrowser();
    vi.useFakeTimers();
    // Local time, deliberately: `today()` is a local-date string, and an evening
    // that is already tomorrow in UTC is exactly what a UTC-based one gets wrong.
    vi.setSystemTime(new Date(2026, 7, 11, 22, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts on the date the app was opened', async () => {
    const store = await openStore();

    expect(store.getSnapshot().data?.today).toBe('2026-08-11');
  });

  it('re-derives when the midnight timer fires', async () => {
    const store = await openStore();

    await vi.advanceTimersByTimeAsync(3 * HOUR);

    expect(store.getSnapshot().data?.today).toBe('2026-08-12');
  });

  it('arms itself again, so the day after rolls over too', async () => {
    const store = await openStore();
    await vi.advanceTimersByTimeAsync(3 * HOUR);

    await vi.advanceTimersByTimeAsync(24 * HOUR);

    expect(store.getSnapshot().data?.today).toBe('2026-08-13');
  });

  it('catches up on refocus when the timer never ran', async () => {
    const store = await openStore();

    // The overnight case: the tab was frozen, so no timer fired — the clock moved
    // on without the app. Coming back to the window is what notices.
    vi.setSystemTime(new Date(2026, 7, 12, 8, 30, 0));
    browser.fire('focus');

    expect(store.getSnapshot().data?.today).toBe('2026-08-12');
  });

  it('catches up on coming back to the tab', async () => {
    const store = await openStore();

    vi.setSystemTime(new Date(2026, 7, 12, 8, 30, 0));
    browser.fire('visibilitychange');

    expect(store.getSnapshot().data?.today).toBe('2026-08-12');
  });

  it('does nothing when the date has not changed', async () => {
    const store = await openStore();
    const before = store.getSnapshot();

    vi.setSystemTime(new Date(2026, 7, 11, 23, 15, 0));
    browser.fire('focus');
    browser.fire('visibilitychange');

    // useSyncExternalStore compares by identity, so a new snapshot here would
    // re-render the whole app every time the window is clicked back into.
    expect(store.getSnapshot()).toBe(before);
  });

  it('publishes a new snapshot when it does change, so the screen follows', async () => {
    const store = await openStore();
    const before = store.getSnapshot();

    vi.setSystemTime(new Date(2026, 7, 12, 8, 30, 0));
    browser.fire('focus');

    expect(store.getSnapshot()).not.toBe(before);
  });

  it('writes nothing to the repo — a new day is a comparison, not an edit', async () => {
    const before = { ...files };
    await openStore();

    await vi.advanceTimersByTimeAsync(27 * HOUR);
    browser.fire('focus');

    expect(commitAttempts).toBe(0);
    expect(files).toEqual(before);
  });
});
