// The device-side copy of the branch as it was last seen on GitHub, so opening
// the app without a connection renders the timesheet instead of an error screen.
//
// What this holds is the *baseline* only — the version every local edit is a
// change from, which is exactly `FileMap.baseText`. Unsynced edits stay
// `pendingStore`'s job, and an offline open layers one over the other the same
// way an online open layers a recovery snapshot over a fresh `/api/load`. Keeping
// the halves apart is what lets one three-way merge (data/merge) serve both
// paths, and what keeps this record free of the dirty/clean ambiguity: it is
// written from the branch's content, never from what is on screen.
//
// Assets — the image bytes under `assets/` — are deliberately not cached. They
// are most of a repo's bytes and none of its meaning, and IndexedDB quota is the
// one budget that decides whether an offline open works at all. Offline, a
// markdown image ref resolves to nothing and renders as its alt text, the same
// fallback `ClientInfoCard` already has; the bytes come back on the next online
// load. Their *paths* are kept, so the map still knows the branch holds them.

import type { FileMap } from '../workspace/paths';
import { TREE_STORE, openDb, withStore } from './idb';
import { repoKeyOf } from './pendingStore';
import type { LoadResponse, RepoContext } from './repoApi';

/** One branch's text content as of the last successful load, pull or push. */
export interface CachedTree {
  /** `${owner}/${repo}/${branch}` — the object-store key. */
  repoKey: string;
  owner: string;
  repo: string;
  branch: string;
  /** The commit this content is from, so a reconnect knows what to diff against. */
  baseCommitSha: string;
  /** Epoch millis when the tree was written. */
  savedAt: number;
  /** repo-relative path -> the branch's UTF-8 text. */
  text: Record<string, string>;
  /** repo-relative path -> blob sha, as `/api/load` returned it. */
  sha: Record<string, string>;
  /** Every path the branch holds, assets included — see the note above on why
   *  the asset *bytes* aren't here but their paths are. Without them, deleting a
   *  cached asset offline would look like dropping a file that was never pushed. */
  remote: string[];
}

/** Mirror the branch content of `fm` for `repo`. Best-effort: resolves quietly
 *  when there is no usable IndexedDB. */
export async function saveTree(fm: FileMap, repo: RepoContext, savedAt: number): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  const tree: CachedTree = {
    repoKey: repoKeyOf(repo.owner, repo.repo, repo.branch),
    owner: repo.owner,
    repo: repo.repo,
    branch: repo.branch,
    baseCommitSha: repo.baseCommitSha,
    savedAt,
    text: Object.fromEntries(fm.baseText),
    sha: Object.fromEntries(fm.baseSha),
    remote: [...fm.remote],
  };
  await withStore(db, TREE_STORE, 'readwrite', undefined, (store) => {
    store.put(tree);
  });
  db.close();
}

/** The cached tree for a repo, or `null` when this device has never loaded it.
 *
 *  `branch` is optional because the repo picker's is: a repo opened without one
 *  resolves to the default branch server-side, which an offline open has no way
 *  to ask about. So a missing branch takes the most recently cached tree for that
 *  repo, which is the branch the user was last working on. */
export async function loadTree(owner: string, repo: string, branch?: string): Promise<CachedTree | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }
  const rows = await withStore<CachedTree[]>(db, TREE_STORE, 'readonly', [], (store, done) => {
    const req = store.getAll();
    req.onsuccess = () => done((req.result as CachedTree[]) ?? []);
  });
  db.close();
  const matches = rows.filter((r) => r.owner === owner && r.repo === repo && (!branch || r.branch === branch));
  return matches.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}

/** Drop every cached tree. Called on sign-out: the snapshots of unsynced work
 *  have to survive that (they are the only copy), but this is a redundant copy of
 *  a private repo, and leaving it on a shared machine after someone signs out
 *  would be a choice nobody made. */
export async function clearTrees(): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await withStore(db, TREE_STORE, 'readwrite', undefined, (store) => {
    store.clear();
  });
  db.close();
}

/** A cached tree in the shape `/api/load` would have returned, so the offline
 *  open path can go through the same `applyLoad` as the online one. `binary` is
 *  empty by design — see the note at the top of this file. */
export function loadResponseOf(tree: CachedTree): LoadResponse {
  return {
    owner: tree.owner,
    repo: tree.repo,
    branch: tree.branch,
    baseCommitSha: tree.baseCommitSha,
    text: tree.text,
    binary: {},
    sha: tree.sha,
  };
}
