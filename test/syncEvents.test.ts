// Syncing on a change kind rather than on a clock.
//
// `autoSync.events` names the changes worth pushing straight away — a task you
// just created, a status you just ticked. The rule that matters is that they are
// independent of the timed auto-sync: someone who doesn't want a background timer
// still gets those changes on the branch within seconds, and someone who has both
// gets the event ones without waiting out `delayMinutes`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AUTO_SYNC_EVENTS, autoSyncEventFor, parseAutoSyncEvents, syncsOnChange } from '../src/model/syncEvents';
import type { AutoSyncEvent } from '../src/model/syncEvents';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';

function configWith(autoSync: { enabled: boolean; delayMinutes: number; events: AutoSyncEvent[] }): string {
  return (
    JSON.stringify(
      { hoursPerDay: 8, weekStart: 1, clients: [{ id: 'acme', name: 'Acme Corp' }], autoSync },
      null,
      2,
    ) + '\n'
  );
}

/** Comfortably past the event debounce, comfortably short of any delay. */
const EVENT_MS = 3_000;
const DELAY_MINUTES = 5;
const DELAY_MS = DELAY_MINUTES * 60_000;

let files: Record<string, string>;
let head: string;
let commits: number;
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
    const body = JSON.parse(String(init?.body)) as {
      files: { path: string; content?: string; base64?: string; deleted?: boolean }[];
    };
    for (const f of body.files) {
      if (f.deleted) {
        delete files[f.path];
      } else {
        // An attachment travels as `base64`; keeping it verbatim is enough here,
        // where all a test asks is whether the bytes reached the branch at all.
        files[f.path] = f.content ?? f.base64 ?? '';
      }
    }
    head = `c${++commits}`;
    return Promise.resolve(Response.json({ commitSha: head, branch: 'main' }));
  }
  throw new Error(`unexpected fetch: ${input}`);
}

async function openStore(autoSync: { enabled: boolean; delayMinutes: number; events: AutoSyncEvent[] }): Promise<typeof WorklogStore> {
  files['.worklog/config.json'] = configWith(autoSync);
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  return mod.worklogStore;
}

describe('the event map', () => {
  it('maps the reasons the services actually pass', () => {
    expect(autoSyncEventFor('addTask')).toBe('taskCreated');
    expect(autoSyncEventFor('setStatus')).toBe('taskStatus');
    expect(autoSyncEventFor('toggleWorked')).toBe('taskStatus');
    expect(autoSyncEventFor('closeTask')).toBe('taskStatus');
    expect(autoSyncEventFor('updateTask')).toBe('taskEdited');
    expect(autoSyncEventFor('setWorklog')).toBe('timeLogged');
    expect(autoSyncEventFor('updateSettings')).toBe('settings');
    expect(autoSyncEventFor('setDayNote')).toBe('dayNote');
    expect(autoSyncEventFor('addPrompt')).toBe('prompt');
    expect(autoSyncEventFor('setPromptRan')).toBe('prompt');
  });

  it('maps the sync machinery to nothing, so a pull can never trigger a sync', () => {
    for (const reason of ['open', 'pull', 'merge', 'restore']) {
      expect(autoSyncEventFor(reason)).toBeUndefined();
      expect(syncsOnChange(AUTO_SYNC_EVENTS.map((e) => e.id), reason)).toBe(false);
    }
  });

  it('normalizes a stored list: unknown ids dropped, duplicates collapsed, order canonical', () => {
    expect(parseAutoSyncEvents(['settings', 'taskCreated', 'taskCreated', 'nonsense'])).toEqual([
      'taskCreated',
      'settings',
    ]);
    expect(parseAutoSyncEvents(undefined)).toEqual([]);
    expect(parseAutoSyncEvents('taskCreated')).toEqual([]);
  });
});

describe('syncing on an event', () => {
  beforeEach(() => {
    files = { 'clients/acme.md': '# Acme Corp\n' };
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

  it('pushes a configured change within seconds, with the timed sync off', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskCreated'] });

    await store.createTask({ title: 'Urgent task', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(EVENT_MS);

    expect(store.hasPending()).toBe(false);
    expect(files['clients/acme.md']).toContain('Urgent task');
  });

  it('leaves a change of an unconfigured kind to the user, with the timed sync off', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskCreated'] });

    await store.setWorklog('2026-08-03', 'acme', 4);
    await vi.advanceTimersByTimeAsync(DELAY_MS * 2);

    expect(commitAttempts).toBe(0);
    expect(store.hasPending()).toBe(true);
  });

  it('beats the delay when both are on', async () => {
    const store = await openStore({ enabled: true, delayMinutes: DELAY_MINUTES, events: ['taskCreated'] });

    await store.createTask({ title: 'Urgent task', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(EVENT_MS);

    expect(files['clients/acme.md']).toContain('Urgent task');
  });

  it('is not pushed back by a change that is not itself a trigger', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskCreated'] });

    await store.createTask({ title: 'Urgent task', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(1_200);
    // Logging time is not a configured trigger. It must neither arm a sync of its
    // own nor restart the one the task is waiting on.
    await store.setWorklog('2026-08-03', 'acme', 4);
    await vi.advanceTimersByTimeAsync(1_200);

    expect(files['clients/acme.md']).toContain('Urgent task');
  });

  it('retries a failed event sync on the delay, rather than waiting for another event', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskCreated'] });
    commitFails = true;

    await store.createTask({ title: 'Offline task', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(EVENT_MS);
    expect(commitAttempts).toBeGreaterThan(0);
    expect(store.hasPending()).toBe(true);

    // The network comes back. Nothing else touches the store — no edit, no button.
    commitFails = false;
    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(store.hasPending()).toBe(false);
    expect(files['clients/acme.md']).toContain('Offline task');
  });

  it('pushes a day note within seconds when that is the ticked event', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['dayNote'] });

    await store.setDayNote('2026-08-03', 'Standup ran long.');
    await vi.advanceTimersByTimeAsync(EVENT_MS);

    expect(store.hasPending()).toBe(false);
    expect(files['notes/2026-08.md']).toContain('Standup ran long.');
  });

  it('leaves a day note alone when the ticked event is a different kind', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskCreated'] });

    await store.setDayNote('2026-08-03', 'Standup ran long.');
    await vi.advanceTimersByTimeAsync(DELAY_MS * 2);

    expect(commitAttempts).toBe(0);
    expect(store.hasPending()).toBe(true);
  });

  it('pushes a prompt within seconds when that is the ticked event', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['prompt'] });
    const task = await store.createTask({ title: 'Write the release notes', clientId: 'acme' });
    // The task itself is not a ticked event, so nothing has been pushed yet: the
    // prompt is what puts both on the branch.
    await vi.advanceTimersByTimeAsync(EVENT_MS);
    expect(commitAttempts).toBe(0);

    await store.addPrompt(task!.id, 'Draft', 'Summarise the changelog since the last tag.');
    await vi.advanceTimersByTimeAsync(EVENT_MS);

    expect(store.hasPending()).toBe(false);
    expect(files['clients/acme.md']).toContain('Summarise the changelog since the last tag.');
  });

  it('pushes an attachment with the task that carries it, on the edit event', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskEdited'] });
    const task = await store.createTask({ title: 'Rebuild the reporting export', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(EVENT_MS);
    expect(commitAttempts).toBe(0);

    await store.addAttachment(task!.id, 'export-spec.pdf', Buffer.from('spec bytes').toString('base64'));
    await vi.advanceTimersByTimeAsync(EVENT_MS);

    expect(store.hasPending()).toBe(false);
    expect(files['clients/acme.md']).toContain('- attachment: assets/export-spec.pdf');
    expect(files['assets/export-spec.pdf']).toBeDefined();
  });

  it('leaves a prompt alone when the ticked event is a different kind', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: ['taskEdited'] });
    const task = await store.createTask({ title: 'Write the release notes', clientId: 'acme' });

    await store.addPrompt(task!.id, 'Draft', 'Summarise the changelog since the last tag.');
    await vi.advanceTimersByTimeAsync(DELAY_MS * 2);

    expect(commitAttempts).toBe(0);
    expect(store.hasPending()).toBe(true);
  });

  it('does nothing on its own when no event is configured and the timed sync is off', async () => {
    const store = await openStore({ enabled: false, delayMinutes: DELAY_MINUTES, events: [] });

    await store.createTask({ title: 'Manual task', clientId: 'acme' });
    await vi.advanceTimersByTimeAsync(DELAY_MS * 2);

    expect(commitAttempts).toBe(0);
    expect(store.hasPending()).toBe(true);
  });
});
