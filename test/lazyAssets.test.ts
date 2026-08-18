// Images load when they are rendered, not when the repo is opened.
//
// /api/load ships asset paths + shas only, so the first paint never waits on
// image bytes. The first `assetUrl` ask for a ref the map has no bytes for
// starts the download; when it lands the store notifies, and the re-render
// resolves the same ref to an object URL. A failed download leaves the
// alt-text fallback standing and a later render retries.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { worklogStore as WorklogStore } from '../src/data/worklogStore';
import { installFakeIndexedDb, installFakeNavigator, installFakeWindow } from './helpers/fakeIndexedDb';

const CONFIG =
  JSON.stringify({ hoursPerDay: 8, weekStart: 1, clients: [{ id: 'acme', name: 'Acme Corp' }] }, null, 2) + '\n';

const ASSET_PATH = 'assets/pasted.png';
const ASSET_SHA = 'a'.repeat(40);
const ASSET_BYTES = new Uint8Array([137, 80, 78, 71]);

let files: Record<string, string>;
let assetRequests: string[];
let assetsOffline: boolean;
let db: ReturnType<typeof installFakeIndexedDb>;
let win: ReturnType<typeof installFakeWindow>;

/** Let the in-flight asset fetch and the notify it triggers run out. */
async function flush(): Promise<void> {
  for (let i = 0; i < 500; i++) {
    await Promise.resolve();
  }
}

function fakeFetch(input: string): Promise<Response> {
  const url = new URL(input, 'https://worklog.test');
  if (url.pathname === '/api/load') {
    return Promise.resolve(
      Response.json({
        owner: 'o',
        repo: 'r',
        branch: 'main',
        baseCommitSha: 'c0',
        text: { ...files },
        // The asset appears in the sha listing only — no bytes in the load.
        sha: { [ASSET_PATH]: ASSET_SHA },
      }),
    );
  }
  if (url.pathname === '/api/asset') {
    assetRequests.push(`${url.searchParams.get('path')}@${url.searchParams.get('sha')}`);
    if (assetsOffline) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    return Promise.resolve(new Response(new Uint8Array(ASSET_BYTES)));
  }
  if (url.pathname === '/api/head') {
    return Promise.resolve(Response.json({ commitSha: 'c0' }));
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

describe('lazy asset loading', () => {
  beforeEach(() => {
    files = { '.worklog/config.json': CONFIG, 'clients/acme.md': '# Acme Corp\n' };
    assetRequests = [];
    assetsOffline = false;
    db = installFakeIndexedDb();
    win = installFakeWindow();
    installFakeNavigator();
    vi.stubGlobal('fetch', fakeFetch as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    db.reset();
    win.reset();
  });

  it('opens without asset bytes, downloads on first ask, and notifies', async () => {
    const store = await startApp();
    expect(assetRequests).toEqual([]); // the load itself pulled no images

    let notified = 0;
    const unsubscribe = store.subscribe(() => notified++);

    // First render: no bytes yet — the alt-text fallback — but the download starts.
    expect(store.assetUrl(ASSET_PATH)).toBeNull();
    await flush();

    expect(assetRequests).toEqual([`${ASSET_PATH}@${ASSET_SHA}`]);
    expect(notified).toBeGreaterThan(0);
    // The re-render the notify caused now resolves the same ref to a URL.
    expect(store.assetUrl(ASSET_PATH)).toMatch(/^blob:/);

    // And asking again is served from memory, not a second download.
    await flush();
    expect(assetRequests).toHaveLength(1);
    unsubscribe();
  });

  it('does not fetch refs the branch does not hold', async () => {
    const store = await startApp();
    expect(store.assetUrl('assets/never-existed.png')).toBeNull();
    await flush();
    expect(assetRequests).toEqual([]);
  });

  it('leaves the fallback standing on a failed download and retries later', async () => {
    assetsOffline = true;
    const store = await startApp();

    expect(store.assetUrl(ASSET_PATH)).toBeNull();
    await flush();
    expect(assetRequests).toHaveLength(1);
    expect(store.assetUrl(ASSET_PATH)).toBeNull(); // still the alt-text fallback; retries
    await flush();
    expect(assetRequests).toHaveLength(2);

    assetsOffline = false;
    // The next render retries and succeeds.
    expect(store.assetUrl(ASSET_PATH)).toBeNull();
    await flush();
    expect(assetRequests).toHaveLength(3);
    expect(store.assetUrl(ASSET_PATH)).toMatch(/^blob:/);
  });
});
