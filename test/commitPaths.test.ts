// The commit path allowlist.
//
// The session token carries GitHub's `repo` scope, so /api/commit can reach every
// repository the user owns. `isWorklogPath` is the only thing keeping a commit
// inside the timesheet layout — a write to `.github/workflows/` would be code
// execution in the user's CI. That makes this a security control, so it gets a
// test: a regression here is silent everywhere else.

import { describe, expect, it, afterEach, vi } from 'vitest';
import { commitFiles, isWorklogPath, UnsafePathError } from '../src/server/github';

describe('isWorklogPath', () => {
  it('accepts every path the Worklog layout is made of', () => {
    for (const path of [
      '.worklog/config.json',
      'worklog.worklog',
      'clients/acme.md',
      'clients/todos.md',
      'archive/acme/2026-06.md',
      'worklog/2026-06.md',
      'notes/2026-06.md',
      'assets/img-abc123.png',
    ]) {
      expect(isWorklogPath(path), path).toBe(true);
    }
  });

  it('rejects writes that would reach outside the timesheet', () => {
    for (const path of [
      '.github/workflows/release.yml',
      'clients/../.github/workflows/release.yml',
      'archive/../../etc/passwd',
      'package.json',
      'README.md',
      'src/index.ts',
      '.worklog/config.json.bak',
      'clients/nested/deep.md',
      'assets/nested/img.png',
      'notes/nested/deep.md',
      'notes/2026-06.md.bak',
      'notes/2026-06.txt',
      'worklog/2026-06.md/../../evil.yml',
    ]) {
      expect(isWorklogPath(path), path).toBe(false);
    }
  });
});

describe('commitFiles path guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Any GitHub call at all means the guard let the payload through. */
  function failOnFetch() {
    const fetchSpy = vi.fn(() => {
      throw new Error('commitFiles reached the network with an unsafe payload');
    });
    vi.stubGlobal('fetch', fetchSpy);
    return fetchSpy;
  }

  it('refuses a payload containing a non-Worklog path, before any request', async () => {
    const fetchSpy = failOnFetch();

    await expect(
      commitFiles('token', 'owner', 'repo', 'main', 'basesha', [
        { path: 'clients/acme.md', content: '# Acme\n' },
        { path: '.github/workflows/pwn.yml', content: 'on: push\n' },
      ], 'chore: sync'),
    ).rejects.toBeInstanceOf(UnsafePathError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('names every offending path in the error', async () => {
    failOnFetch();

    const err = await commitFiles('token', 'owner', 'repo', 'main', 'basesha', [
      { path: '.github/workflows/a.yml', content: '' },
      { path: 'clients/acme.md', content: '' },
      { path: 'package.json', content: '' },
    ], 'chore: sync').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(UnsafePathError);
    expect((err as UnsafePathError).paths).toEqual(['.github/workflows/a.yml', 'package.json']);
  });

  it('guards deletions too — a delete names a path just like a write', async () => {
    const fetchSpy = failOnFetch();

    await expect(
      commitFiles('token', 'owner', 'repo', 'main', 'basesha', [{ path: '.github/workflows/ci.yml', deleted: true }], 'chore: sync'),
    ).rejects.toBeInstanceOf(UnsafePathError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lets an all-Worklog payload through to GitHub', async () => {
    // Far enough to prove the guard passed: the first call is the ref lookup, and
    // failing it here keeps the test off the network without weakening the point.
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 500 }));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      commitFiles('token', 'owner', 'repo', 'main', 'basesha', [
        { path: 'clients/acme.md', content: '# Acme\n' },
        { path: 'worklog/2026-06.md', content: '# Worklog\n' },
        { path: 'assets/img-1.png', base64: 'AAAA' },
      ], 'chore: sync'),
    ).rejects.toThrow(/GitHub/);

    expect(fetchSpy).toHaveBeenCalled();
  });

  it('still short-circuits an empty payload', async () => {
    const fetchSpy = failOnFetch();

    await expect(commitFiles('token', 'owner', 'repo', 'main', 'basesha', [], 'chore: sync')).resolves.toEqual({
      commitSha: 'basesha',
      branch: 'main',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
