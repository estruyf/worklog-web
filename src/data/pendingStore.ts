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
//   - One record per repo, keyed by `${owner}/${repo}/${branch}`.

const DB_NAME = 'worklog';
const STORE_NAME = 'pending';
const DB_VERSION = 1;

/** A snapshot of the dirty files for one repo, plus the base it was edited on. */
export interface PendingSnapshot {
  /** `${owner}/${repo}/${branch}` — the object-store key. */
  repoKey: string;
  owner: string;
  repo: string;
  branch: string;
  /** The commit the edits were made against, to warn if the branch has moved. */
  baseCommitSha: string;
  /** Epoch millis when the snapshot was written, for a human-friendly age. */
  savedAt: number;
  /** repo-relative path -> UTF-8 text. */
  text: Record<string, string>;
  /** repo-relative path -> base64 bytes. */
  binary: Record<string, string>;
  /** The dirty paths (a subset of the text/binary keys). */
  dirty: string[];
}

/** Compose the object-store key from a repo triple. */
export function repoKeyOf(owner: string, repo: string, branch: string): string {
  return `${owner}/${repo}/${branch}`;
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
        db.createObjectStore(STORE_NAME, { keyPath: 'repoKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

/** Persist (overwrite) the snapshot for its repo. Resolves even on failure. */
export async function savePending(snapshot: PendingSnapshot): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Load the saved snapshot for a repo, or `null` if none / on failure. */
export async function loadPending(repoKey: string): Promise<PendingSnapshot | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }
  const result = await new Promise<PendingSnapshot | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(repoKey);
      req.onsuccess = () => resolve((req.result as PendingSnapshot) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return result;
}

/** Drop the saved snapshot for a repo (after a successful sync or a discard). */
export async function clearPending(repoKey: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(repoKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}
