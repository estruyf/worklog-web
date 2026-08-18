// Two browser instances on one repo, against a fake GitHub.
//
// This is the bug this suite exists for: an unsynced task in one tab used to be
// wiped out by whichever instance pushed the same file last, because a commit
// writes whole files. Each instance is a separate module graph (its own store
// singleton, its own mounted FileMap); they share only the fake branch, exactly
// like two tabs sharing a repo.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';

type Files = Record<string, string>;

interface FakeGitHub {
  files: Files;
  head: string;
  commits: number;
}

const INITIAL: Files = {
  '.worklog/config.json': JSON.stringify(
    { hoursPerDay: 8, weekStart: 1, clients: [{ id: 'acme', name: 'Acme Corp' }] },
    null,
    2,
  ) + '\n',
  'clients/acme.md': '# Acme Corp\n\n## Existing task\n- id: t_exist\n- status: open\n- created: 2026-07-01\n',
  'notes/2026-07.md': '# Notes 2026-07\n\n## 2026-07-01\n\nExisting note.\n',
};

let github: FakeGitHub;

/** Stand-in for /api/load, /api/head and /api/commit, backed by one branch. */
function fakeFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, 'https://worklog.test');
  if (url.pathname === '/api/head') {
    return Promise.resolve(Response.json({ commitSha: github.head }));
  }
  if (url.pathname === '/api/load') {
    return Promise.resolve(
      Response.json({
        owner: 'o',
        repo: 'r',
        branch: 'main',
        baseCommitSha: github.head,
        text: { ...github.files },
        sha: {},
      }),
    );
  }
  if (url.pathname === '/api/commit') {
    const body = JSON.parse(String(init?.body)) as {
      baseCommitSha: string;
      files: { path: string; content?: string; deleted?: boolean }[];
    };
    if (body.baseCommitSha !== github.head) {
      return Promise.resolve(new Response(JSON.stringify({ conflict: true }), { status: 409 }));
    }
    for (const f of body.files) {
      if (f.deleted) {
        delete github.files[f.path];
      } else {
        github.files[f.path] = f.content ?? '';
      }
    }
    github.head = `c${++github.commits}`;
    return Promise.resolve(Response.json({ commitSha: github.head, branch: 'main' }));
  }
  throw new Error(`unexpected fetch: ${input}`);
}

/** A fresh module graph = a fresh browser instance with its own store. */
async function openInstance(): Promise<typeof WorklogStore> {
  vi.resetModules();
  const mod = (await import('../src/data/worklogStore')) as typeof import('../src/data/worklogStore');
  await mod.worklogStore.open('o', 'r', 'main');
  return mod.worklogStore;
}

const titles = (store: typeof WorklogStore) => store.getSnapshot().data!.tasks.map((t) => t.title).sort();
const noteFor = (store: typeof WorklogStore, date: string) =>
  store.getSnapshot().data!.dayNotes.find((n) => n.date === date)?.body;

describe('two instances syncing the same repo', () => {
  beforeEach(() => {
    github = { files: { ...INITIAL }, head: 'c0', commits: 0 };
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps an unsynced task when the other instance syncs first', async () => {
    const one = await openInstance();
    const two = await openInstance();

    // Instance one adds a task and leaves it unsynced.
    await one.createTask({ title: 'From instance one', clientId: 'acme' });
    expect(one.hasPending()).toBe(true);

    // Instance two updates an existing task and syncs.
    const existing = two.getSnapshot().data!.tasks.find((t) => t.title === 'Existing task')!;
    await two.setStatus(existing.id, 'in-progress');
    await two.sync();

    // Instance one syncs afterwards.
    await one.sync();

    expect(github.files['clients/acme.md']).toContain('From instance one');
    expect(github.files['clients/acme.md']).toContain('- status: in-progress');
    expect(titles(one)).toEqual(['Existing task', 'From instance one']);
    expect(one.hasPending()).toBe(false);
  });

  it('keeps the other instance\'s task when this one pushed first', async () => {
    const one = await openInstance();
    const two = await openInstance();

    // The reverse order: the already-pushed task must survive the second push.
    await one.createTask({ title: 'From instance one', clientId: 'acme' });
    await one.sync();

    await two.createTask({ title: 'From instance two', clientId: 'acme' });
    await two.sync();

    expect(github.files['clients/acme.md']).toContain('From instance one');
    expect(github.files['clients/acme.md']).toContain('From instance two');
    expect(titles(two)).toEqual(['Existing task', 'From instance one', 'From instance two']);
  });

  it('carries a priority set on one side through the other side\'s push', async () => {
    // Priority needs no merge strategy of its own — the record key is still the
    // task's `- id:`, so a one-sided change wins. This is what proves it, and
    // what would fail if the field were ever moved out of the task block.
    const one = await openInstance();
    const two = await openInstance();

    const existing = one.getSnapshot().data!.tasks.find((t) => t.title === 'Existing task')!;
    await one.updateTask(existing.id, { priority: 'urgent' });

    await two.createTask({ title: 'From instance two', clientId: 'acme' });
    await two.sync();
    await one.sync();

    expect(github.files['clients/acme.md']).toContain('- priority: urgent');
    expect(github.files['clients/acme.md']).toContain('From instance two');
    expect(one.getSnapshot().data!.tasks.find((t) => t.id === existing.id)?.priority).toBe('urgent');
  });

  it('merges edits to different files without touching each other', async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.createTask({ title: 'From instance one', clientId: 'acme' });
    await two.setWorklog('2026-07-15', 'acme', 8, 'Logged elsewhere');
    await two.sync();
    await one.sync();

    expect(github.files['clients/acme.md']).toContain('From instance one');
    expect(github.files['worklog/2026-07.md']).toContain('- 2026-07-15 acme 8 — Logged elsewhere');
    expect(one.getSnapshot().data!.worklog).toHaveLength(1);
  });

  it('merges new clients added on both sides into config.json', async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.createClient('Initech');
    await two.createClient('Globex');
    await two.sync();
    await one.sync();

    const config = JSON.parse(github.files['.worklog/config.json']) as { clients: { id: string }[] };
    expect(config.clients.map((c) => c.id).sort()).toEqual(['acme', 'globex', 'initech']);
    expect(one.getSnapshot().data!.clients.map((c) => c.id).sort()).toEqual(['acme', 'globex', 'initech']);
  });

  it('keeps an unsynced day note when the other instance syncs a different day first', async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.setDayNote('2026-07-02', 'From instance one.');
    expect(one.hasPending()).toBe(true);

    await two.setDayNote('2026-07-03', 'From instance two.');
    await two.sync();

    await one.sync();

    // Asserted at both levels on purpose: a bad merge can produce text that
    // still looks like a notes file but reads back as something else.
    expect(github.files['notes/2026-07.md']).toContain('From instance one.');
    expect(github.files['notes/2026-07.md']).toContain('From instance two.');
    expect(noteFor(one, '2026-07-01')).toBe('Existing note.');
    expect(noteFor(one, '2026-07-02')).toBe('From instance one.');
    expect(noteFor(one, '2026-07-03')).toBe('From instance two.');
    expect(one.hasPending()).toBe(false);
  });

  it("keeps the other instance's day note when this one pushed first", async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.setDayNote('2026-07-02', 'From instance one.');
    await one.sync();

    await two.setDayNote('2026-07-03', 'From instance two.');
    await two.sync();

    expect(noteFor(two, '2026-07-02')).toBe('From instance one.');
    expect(noteFor(two, '2026-07-03')).toBe('From instance two.');
  });

  it('keeps the local text and reports a day both instances wrote', async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.setDayNote('2026-07-01', 'One rewrote it.');
    await two.setDayNote('2026-07-01', 'Two rewrote it.');
    await two.sync();
    await one.sync();

    expect(noteFor(one, '2026-07-01')).toBe('One rewrote it.');
    expect(github.files['notes/2026-07.md']).toContain('One rewrote it.');
    expect(github.files['notes/2026-07.md']).not.toContain('Two rewrote it.');
  });

  it('honours a note cleared here against another day written on the branch', async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.setDayNote('2026-07-01', '');
    await two.setDayNote('2026-07-05', 'Still here.');
    await two.sync();
    await one.sync();

    expect(noteFor(one, '2026-07-01')).toBeUndefined();
    expect(noteFor(one, '2026-07-05')).toBe('Still here.');
    expect(github.files['notes/2026-07.md']).not.toContain('Existing note.');
  });

  it('re-merges when the branch moves between the head check and the commit', async () => {
    const one = await openInstance();
    const two = await openInstance();

    await one.createTask({ title: 'From instance one', clientId: 'acme' });
    await two.createTask({ title: 'From instance two', clientId: 'acme' });

    // Instance two lands its commit after one has read the head but before its
    // commit arrives, so the commit is rejected with a 409 and has to re-merge.
    const realFetch = fakeFetch;
    let armed = true;
    vi.stubGlobal('fetch', ((input: string, init?: RequestInit) => {
      const isCommit = new URL(input, 'https://worklog.test').pathname === '/api/commit';
      if (isCommit && armed) {
        armed = false;
        const body = JSON.parse(String(init?.body)) as { files: { path: string; content?: string }[] };
        // Only intercept instance one's commit.
        if (body.files.some((f) => f.content?.includes('From instance one'))) {
          return two.sync().then(() => realFetch(input, init));
        }
      }
      return realFetch(input, init);
    }) as unknown as typeof fetch);

    await one.sync();

    expect(github.files['clients/acme.md']).toContain('From instance one');
    expect(github.files['clients/acme.md']).toContain('From instance two');
  });
});
