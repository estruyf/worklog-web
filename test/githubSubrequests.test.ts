// Workers caps subrequests per invocation (50 on the free plan). loadRepo and
// commitFiles used to spend one per file, so a timesheet that grew past ~47
// Markdown files stopped syncing. These fake GitHub and count what each call
// spends, so a fan-out that scales with the repo can't come back unnoticed.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitFiles, loadRepo } from '../src/server/github';

const FILES = 250;
const paths = Array.from({ length: FILES }, (_, i) => `clients/c${i}.md`);
const shaOf = (path: string) => `sha-${path}`;
const textOf = (path: string) => `# ${path}\n`;

/** A fake api.github.com that answers the calls github.ts makes and logs each one. */
function fakeGitHub(opts: { truncated?: string } = {}) {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });
    const u = url.replace('https://api.github.com', '');
    if (u.includes('/git/ref/heads/')) {
      return json({ object: { sha: 'head' } });
    }
    if (u.includes('/git/commits/')) {
      return json({ tree: { sha: 'tree' } });
    }
    if (u.includes('/git/trees/') && method === 'GET') {
      return json({ tree: [...paths.map((p) => ({ path: p, type: 'blob', sha: shaOf(p) })), { path: 'assets/a.png', type: 'blob', sha: 'img' }] });
    }
    if (u === '/graphql') {
      const vars = body.variables as Record<string, string>;
      const repository: Record<string, unknown> = {};
      for (const [k, sha] of Object.entries(vars)) {
        if (/^s\d+$/.test(k)) {
          const path = sha.slice('sha-'.length);
          repository[`b${k.slice(1)}`] = path === opts.truncated ? { text: 'cut', isTruncated: true } : { text: textOf(path), isTruncated: false };
        }
      }
      return json({ data: { repository } });
    }
    if (u.includes('/git/blobs/') && method === 'GET') {
      const path = u.split('/git/blobs/')[1].slice('sha-'.length);
      return json({ content: btoa(textOf(path)), encoding: 'base64' });
    }
    if (u.endsWith('/git/blobs')) {
      return json({ sha: 'new-blob' });
    }
    if (u.endsWith('/git/trees')) {
      return json({ sha: 'new-tree' });
    }
    if (u.endsWith('/git/commits')) {
      return json({ sha: 'new-commit' });
    }
    if (u.includes('/git/refs/heads/')) {
      return json({});
    }
    throw new Error(`unexpected ${method} ${u}`);
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GitHub subrequest budget', () => {
  it('loads every text file of a large repo in a bounded number of requests', async () => {
    const calls = fakeGitHub();
    const loaded = await loadRepo('t', 'o', 'r', 'main');
    expect(Object.keys(loaded.text)).toHaveLength(FILES);
    expect(loaded.text['clients/c42.md']).toBe(textOf('clients/c42.md'));
    expect(loaded.sha['assets/a.png']).toBe('img');
    // ref + commit + tree + ceil(250 / 100) GraphQL batches.
    expect(calls).toHaveLength(6);
  });

  it('falls back to the REST read for a blob GraphQL truncates', async () => {
    const calls = fakeGitHub({ truncated: 'clients/c7.md' });
    const loaded = await loadRepo('t', 'o', 'r', 'main');
    expect(loaded.text['clients/c7.md']).toBe(textOf('clients/c7.md'));
    expect(calls.filter((c) => c.url.includes('/git/blobs/'))).toHaveLength(1);
  });

  it('commits many text files without a blob request per file', async () => {
    const calls = fakeGitHub();
    const files = [...paths.map((path) => ({ path, content: textOf(path) })), { path: 'assets/a.png', base64: 'AAAA' }, { path: 'clients/gone.md', deleted: true }];
    const result = await commitFiles('t', 'o', 'r', 'main', 'head', files, 'msg');
    expect(result.commitSha).toBe('new-commit');
    // ref + commit + one asset blob + tree + commit + ref.
    expect(calls).toHaveLength(6);
    const tree = calls.find((c) => c.url.endsWith('/git/trees'))!.body as { tree: Array<Record<string, unknown>> };
    expect(tree.tree.find((e) => e.path === 'clients/c0.md')).toEqual({ path: 'clients/c0.md', mode: '100644', type: 'blob', content: textOf('clients/c0.md') });
    expect(tree.tree.find((e) => e.path === 'assets/a.png')?.sha).toBe('new-blob');
    expect(tree.tree.find((e) => e.path === 'clients/gone.md')?.sha).toBeNull();
  });
});
