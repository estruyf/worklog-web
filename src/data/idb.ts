// The IndexedDB plumbing the two device-side stores share: `pendingStore` (edits
// that haven't reached GitHub) and `repoCache` (the branch as it was last seen).
//
// One module owns the database because one database can only be opened at one
// version: two modules calling `indexedDB.open('worklog', …)` with versions of
// their own would block each other's upgrade, and a blocked upgrade is invisible
// until the day someone bumps one of them.
//
// Every call is defensive. Device-side storage here is a safety net, never the
// source of truth, so a failing or absent IndexedDB (private mode, SSR, quota,
// a tab holding the old version open) resolves quietly rather than breaking the
// app that is only trying to save a copy.

const DB_NAME = 'worklog';

/** v1: one `pending` record per repo. v2: `snapshots`, one record per repo *per
 *  browser instance*. v3: adds `trees` — the cached branch contents an offline
 *  open renders from. Bumping this means adding to `onupgradeneeded` below, not
 *  replacing it: a user arrives at v3 from either of the earlier versions. */
const DB_VERSION = 3;

/** v1's store. Read once on open so a snapshot written by the old build is still
 *  recoverable, never written. */
export const LEGACY_PENDING_STORE = 'pending';
export const SNAPSHOT_STORE = 'snapshots';
export const TREE_STORE = 'trees';

export function openDb(): Promise<IDBDatabase | null> {
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
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(TREE_STORE)) {
        db.createObjectStore(TREE_STORE, { keyPath: 'repoKey' });
      }
      // The v1 store is left in place; `loadPending` drains it on the next open.
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

/** Run `body` inside a transaction, resolving to `fallback` on any failure. */
export function withStore<T>(
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
