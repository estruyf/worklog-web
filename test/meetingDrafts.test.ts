// What a meeting holds before Save is pressed.
//
// The draft is the third device-side record, and the one thing that must stay
// true of it is that it is *not* repo state: typing into an open meeting may not
// dirty the tree, may not reach GitHub, and may not survive being saved. What it
// must do is outlive the tab, which is the whole reason the Save button can exist.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';
import { installFakeIndexedDb, installFakeNavigator, installFakeWindow } from './helpers/fakeIndexedDb';

const CONFIG =
  JSON.stringify(
    {
      hoursPerDay: 8,
      weekStart: 1,
      clients: [{ id: 'acme', name: 'Acme Corp' }],
      // Sync on a meeting change, so "saving is what arms the sync" is what the
      // commit count below is actually measuring.
      autoSync: { enabled: false, delayMinutes: 1, events: ['meeting'] },
    },
    null,
    2,
  ) + '\n';

/** Past the event-sync debounce, so an armed commit would have fired by now. */
const EVENT_SYNC_MS = 4_000;

let files: Record<string, string>;
let head: string;
let commits: number;
let db: ReturnType<typeof installFakeIndexedDb>;
let win: ReturnType<typeof installFakeWindow>;

async function flush(): Promise<void> {
  for (let i = 0; i < 500; i++) {
    await Promise.resolve();
  }
}

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

/** Start the app fresh, the way reopening it on this device does. */
async function startApp(): Promise<typeof WorklogStore> {
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  await flush();
  return mod.worklogStore;
}

describe('meeting drafts', () => {
  beforeEach(() => {
    files = { '.worklog/config.json': CONFIG, 'clients/acme.md': '# Acme Corp\n' };
    head = 'c0';
    commits = 0;
    db = installFakeIndexedDb();
    win = installFakeWindow();
    installFakeNavigator();
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    db.reset();
    win.reset();
  });

  it('keeps a draft off the branch until it is saved', async () => {
    const store = await startApp();
    const meeting = await store.createMeeting({ date: '2026-09-24', clientId: 'acme', title: 'Kickoff' });
    await vi.advanceTimersByTimeAsync(EVENT_SYNC_MS);
    await flush();
    const commitsAfterStart = commits;

    await store.saveMeetingDraft(meeting!.id, { notes: 'Half a sentence.' });
    await vi.advanceTimersByTimeAsync(EVENT_SYNC_MS);
    await flush();

    // Typing is not an edit: nothing new to push, and nothing in the Markdown.
    expect(commits).toBe(commitsAfterStart);
    expect(store.hasPending()).toBe(false);
    expect(files['meetings/2026-09.md']).not.toContain('Half a sentence.');
    expect(await store.meetingDraft(meeting!.id)).toEqual({ notes: 'Half a sentence.' });
  });

  it('writes the draft through on save, and drops it', async () => {
    const store = await startApp();
    const meeting = await store.createMeeting({ date: '2026-09-24', clientId: 'acme', title: 'Kickoff' });
    await store.saveMeetingDraft(meeting!.id, { notes: 'Half a sentence.' });
    await flush();

    await store.saveMeeting(meeting!.id, { notes: 'A whole one, in the end.' });
    await vi.advanceTimersByTimeAsync(EVENT_SYNC_MS);
    await flush();

    expect(files['meetings/2026-09.md']).toContain('A whole one, in the end.');
    expect(await store.meetingDraft(meeting!.id)).toBeNull();
  });

  it('carries a draft across closing the tab', async () => {
    const first = await startApp();
    const meeting = await first.createMeeting({ date: '2026-09-24', clientId: 'acme', title: 'Kickoff' });
    await first.saveMeetingDraft(meeting!.id, { notes: 'Typed, lid closed.' });
    await flush();

    const second = await startApp();

    expect(await second.meetingDraft(meeting!.id)).toEqual({ notes: 'Typed, lid closed.' });
  });

  it('drops the draft when the meeting is deleted', async () => {
    const store = await startApp();
    const meeting = await store.createMeeting({ date: '2026-09-24', clientId: 'acme', title: 'Kickoff' });
    await store.saveMeetingDraft(meeting!.id, { notes: 'Never mind.' });
    await flush();

    await store.deleteMeeting(meeting!.id);
    await flush();

    expect(await store.meetingDraft(meeting!.id)).toBeNull();
  });
});
