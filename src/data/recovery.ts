// The translation between the in-memory file map and the IndexedDB snapshot that
// makes unsynced edits survive a crash or a closed tab. `pendingStore` owns the
// database; this owns what goes into a record and how one comes back out.

import { FileMap, removeFileFrom } from '../workspace/paths';
import { base64ToBytes, bytesToBase64 } from './bytes';
import { mergeFile } from './merge';
import { instanceId, snapshotKeyOf, type PendingSnapshot } from './pendingStore';
import type { RepoContext } from './repoApi';

/** Mirror the dirty files of `fm` into a snapshot record. */
export function snapshotOf(fm: FileMap, repo: RepoContext, repoKey: string, savedAt: number): PendingSnapshot {
  const text: Record<string, string> = {};
  const baseText: Record<string, string> = {};
  const binary: Record<string, string> = {};
  const deleted: string[] = [];
  for (const path of fm.dirty) {
    if (fm.deleted.has(path)) {
      deleted.push(path);
    } else if (fm.binary.has(path)) {
      binary[path] = bytesToBase64(fm.binary.get(path)!);
    } else {
      text[path] = fm.text.get(path) ?? '';
    }
    // Mirror the ancestor too: a restore three-way merges against the branch, and
    // by then this instance's in-memory base is gone.
    const base = fm.baseText.get(path);
    if (base !== undefined) {
      baseText[path] = base;
    }
  }
  return {
    key: snapshotKeyOf(repoKey, instanceId()),
    instanceId: instanceId(),
    repoKey,
    owner: repo.owner,
    repo: repo.repo,
    branch: repo.branch,
    baseCommitSha: repo.baseCommitSha,
    savedAt,
    text,
    baseText,
    binary,
    dirty: [...fm.dirty],
    deleted,
  };
}

/** Would restoring this snapshot change anything? False when every edit in it is
 *  already on the branch `fm` was loaded from, which is what a snapshot left behind
 *  by an interrupted cleanup looks like — and asking "recover these?" about work
 *  that landed days ago teaches people to distrust the one prompt that matters.
 *
 *  A conflict counts as true even when the merge would settle on the branch's text:
 *  that is a decision the person should see, not one to take by deleting their copy.
 *  An asset is on the branch if its path is, since asset names are single-use. */
export function holdsUnsyncedWork(fm: FileMap, saved: PendingSnapshot): boolean {
  const deleted = new Set(saved.deleted ?? []);
  return saved.dirty.some((path) => {
    if (Object.prototype.hasOwnProperty.call(saved.binary, path)) {
      return !fm.remote.has(path);
    }
    const local = deleted.has(path) ? undefined : (saved.text[path] ?? '');
    const remote = fm.text.get(path);
    const merged = mergeFile(path, { base: saved.baseText?.[path], local, remote });
    return merged.conflicts.length > 0 || merged.text !== remote;
  });
}

/** Re-apply a snapshot's dirty files over a freshly-loaded file map and mark them
 *  for the next sync. Returns the conflict messages worth showing.
 *
 *  The branch may have moved since the snapshot was written, so a text file is
 *  three-way merged against what was just loaded rather than written over it —
 *  otherwise restoring would undo whatever reached the branch in the meantime. */
export function applySnapshot(fm: FileMap, saved: PendingSnapshot): string[] {
  const deleted = new Set(saved.deleted ?? []);
  const conflicts: string[] = [];
  for (const path of saved.dirty) {
    if (Object.prototype.hasOwnProperty.call(saved.binary, path)) {
      fm.binary.set(path, base64ToBytes(saved.binary[path]));
      fm.markDirty(path);
      continue;
    }
    const local = deleted.has(path) ? undefined : (saved.text[path] ?? '');
    const merged = mergeFile(path, { base: saved.baseText?.[path], local, remote: fm.text.get(path) });
    conflicts.push(...merged.conflicts);
    if (merged.text === undefined) {
      removeFileFrom(fm, path);
    } else {
      fm.text.set(path, merged.text);
      fm.deleted.delete(path);
      fm.markDirty(path);
    }
  }
  return conflicts;
}
