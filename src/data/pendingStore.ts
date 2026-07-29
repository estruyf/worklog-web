// Durable crash/close recovery for unsynced edits.
//
// The worklog data layer keeps edited-but-not-committed files in an in-memory
// `FileMap` (see workspace/paths). That state is lost if the tab is closed or
// reloaded before a sync reaches GitHub. This module mirrors the dirty files into
// IndexedDB so they can be recovered on the next open.
//
// Design notes:
//   - IndexedDB (not localStorage) because snapshots include binary image bytes
//     and can exceed localStorage's synchronous ~5MB budget.
//   - Every call is defensive: persistence is a best-effort safety net, so a
//     failing/absent IndexedDB (private mode, SSR, quota) resolves quietly and
//     never breaks the app.
//   - One record per repo *per instance*, keyed `${owner}/${repo}/${branch}#${instanceId}`.
//     Two tabs on the same repo share an origin and therefore this database: with
//     a single per-repo record they overwrite each other's snapshot, and the
//     first one to sync deletes the other's still-unsynced work. The instance id
//     lives in sessionStorage, so it is stable across a reload of one tab and
//     distinct between tabs.

const DB_NAME = 'worklog';
/** v1 store: one record per repo, keyed by `repoKey`. Read once on open so a
 *  snapshot written by the previous build is still recoverable, never written. */
const LEGACY_STORE = 'pending';
const STORE_NAME = 'snapshots';
const DB_VERSION = 2;
const INSTANCE_KEY = 'worklog:instance';

/** A snapshot of the dirty files for one repo, plus the base it was edited on. */
export interface PendingSnapshot {
  /** `${repoKey}#${instanceId}` — the object-store key. */
  key: string;
  /** `${owner}/${repo}/${branch}` — which repo the snapshot belongs to. */
  repoKey: string;
  /** The browser instance (tab) that wrote it. */
  instanceId: string;
  owner: string;
  repo: string;
  branch: string;
  /** The commit the edits were made against, to warn if the branch has moved. */
  baseCommitSha: string;
  /** Epoch millis when the snapshot was written, for a human-friendly age. */
  savedAt: number;
  /** repo-relative path -> UTF-8 text. */
  text: Record<string, string>;
  /** repo-relative path -> the branch's text at the time of editing, so a restore
   *  can three-way merge instead of overwriting (see data/merge). */
  baseText: Record<string, string>;
  /** repo-relative path -> base64 bytes. */
  binary: Record<string, string>;
  /** The dirty paths (the text/binary keys, plus the deleted ones). */
  dirty: string[];
  /** Dirty paths that were deleted, so they aren't restored as empty files.
   *  Absent on snapshots written before deletes existed. */
  deleted?: string[];
}

/** Compose the repo identity from a repo triple. */
export function repoKeyOf(owner: string, repo: string, branch: string): string {
  return `${owner}/${repo}/${branch}`;
}

/** The object-store key for one instance's snapshot of a repo. */
export function snapshotKeyOf(repoKey: string, instanceId: string): string {
  return `${repoKey}#${instanceId}`;
}

let cachedInstanceId: string | undefined;

/** This tab's id: stable across reloads of the tab (sessionStorage), distinct
 *  from every other tab, so instances never overwrite each other's snapshot. */
export function instanceId(): string {
  if (cachedInstanceId) {
    return cachedInstanceId;
  }
  let id: string | null = null;
  try {
    id = sessionStorage.getItem(INSTANCE_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(INSTANCE_KEY, id);
    }
  } catch {
    // No sessionStorage (SSR, blocked storage): a per-load id still keeps this
    // instance from clobbering another's record.
    id = randomId();
  }
  cachedInstanceId = id;
  return id;
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `i${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
      // The v1 store is left in place; `loadPending` drains it on the next open.
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Run `body` inside a transaction, resolving to `fallback` on any failure. */
function withStore<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fallback: T,
  body: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve(fallback);
      return;
    }
    try {
      let value = fallback;
      const tx = db.transaction(storeName, mode);
      body(tx.objectStore(storeName), (v) => {
        value = v;
      });
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => resolve(fallback);
      tx.onabort = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
}

/** Persist (overwrite) this instance's snapshot for its repo. Resolves even on
 *  failure. Other instances' snapshots are untouched. */
export async function savePending(snapshot: PendingSnapshot): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await withStore(db, STORE_NAME, 'readwrite', undefined, (store) => {
    store.put(snapshot);
  });
  db.close();
}

/** The recoverable snapshot for a repo, or `null` if there is none.
 *
 *  This instance's own snapshot (a reload of this tab) wins. Failing that, the
 *  newest snapshot another instance left behind is offered: it usually comes
 *  from a tab that was closed with unsynced work, which is exactly what recovery
 *  is for. It can also come from a tab that is still open — restoring then
 *  duplicates that tab's edits into this one, which the sync merge reconciles
 *  record by record, so the cost of the occasional double offer is far below the
 *  cost of dropping unsynced work on the floor. */
export async function loadPending(repoKey: string): Promise<PendingSnapshot | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }
  const rows = await withStore<PendingSnapshot[]>(db, STORE_NAME, 'readonly', [], (store, done) => {
    const req = store.getAll();
    req.onsuccess = () => done((req.result as PendingSnapshot[]) ?? []);
  });
  const legacy = await drainLegacy(db, repoKey);
  db.close();

  const mine = snapshotKeyOf(repoKey, instanceId());
  const candidates = [...rows.filter((r) => r.repoKey === repoKey), ...legacy];
  return candidates.find((r) => r.key === mine) ?? candidates.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

/** Read (and remove) a snapshot written by the pre-instance-id build, so work
 *  left unsynced across the upgrade is still offered exactly once. */
async function drainLegacy(db: IDBDatabase, repoKey: string): Promise<PendingSnapshot[]> {
  const old = await withStore<PendingSnapshot | null>(db, LEGACY_STORE, 'readwrite', null, (store, done) => {
    const req = store.get(repoKey);
    req.onsuccess = () => {
      const row = req.result as PendingSnapshot | undefined;
      if (row) {
        done({ ...row, key: `${repoKey}#legacy`, instanceId: 'legacy', baseText: row.baseText ?? {} });
        store.delete(repoKey);
      }
    };
  });
  return old ? [old] : [];
}

/** Drop this instance's snapshot for a repo (after a successful sync or a
 *  discard). Never touches another instance's still-unsynced work. */
export async function clearPending(repoKey: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await withStore(db, STORE_NAME, 'readwrite', undefined, (store) => {
    store.delete(snapshotKeyOf(repoKey, instanceId()));
  });
  db.close();
}

/** Drop a specific snapshot — used when the user discards a recovered one that
 *  another instance (or the previous build) left behind. */
export async function clearSnapshot(key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await withStore(db, STORE_NAME, 'readwrite', undefined, (store) => {
    store.delete(key);
  });
  db.close();
}
