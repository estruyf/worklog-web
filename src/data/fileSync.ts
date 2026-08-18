// FileMap-level operations the sync goes through. Each one takes the file map
// it works on and returns what the caller needs to decide the next step; none of
// them fetch, re-parse or notify — that sequencing is the store's job.

import { FileMap } from '../workspace/paths';
import { bytesToBase64 } from './bytes';
import { mergeFile } from './merge';
import type { LoadResponse, OutgoingFile } from './repoApi';

/** Build the in-memory tree for a freshly-loaded branch. Asset bytes are not
 *  part of a load — they arrive path-by-path when an image is rendered — so
 *  `remote` is derived from the sha listing, which names every blob the branch
 *  holds, not from which contents happen to be in memory. */
export function fileMapOf(data: LoadResponse): FileMap {
  const fm = new FileMap();
  for (const [path, text] of Object.entries(data.text)) {
    fm.text.set(path, text);
    // The version every later edit is a change *from*, for the sync merge.
    fm.baseText.set(path, text);
  }
  for (const [path, sha] of Object.entries(data.sha)) {
    fm.baseSha.set(path, sha);
    fm.remote.add(path);
  }
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  return fm;
}

/** The dirty files as a commit payload: written (text or base64) or removed. */
export function outgoingFiles(fm: FileMap): OutgoingFile[] {
  return [...fm.dirty].map((path) => {
    if (fm.deleted.has(path)) {
      return { path, deleted: true };
    }
    if (fm.binary.has(path)) {
      return { path, base64: bytesToBase64(fm.binary.get(path)!) };
    }
    return { path, content: fm.text.get(path) ?? '' };
  });
}

/** Record a landed commit against the file map and settle the paths it carried.
 *
 *  The branch now holds exactly what was just written, so a later delete of any
 *  of these paths knows it has to reach GitHub — and the pushed content becomes
 *  the ancestor the next merge compares against.
 *
 *  Only the paths in `files` are settled, and a text file only if it still holds
 *  what was committed. The payload is built before the request goes out, so an
 *  edit made while it was in flight is in the map but not in the commit; clearing
 *  the whole dirty set (as this used to) dropped that edit on the floor — off the
 *  next commit, out of the recovery snapshot, and gone from view on the next
 *  reload, with the UI reporting everything as synced. */
export function markPushed(fm: FileMap, files: OutgoingFile[]): void {
  for (const f of files) {
    if (f.deleted) {
      fm.remote.delete(f.path);
      fm.baseText.delete(f.path);
      fm.deleted.delete(f.path);
      fm.dirty.delete(f.path);
      continue;
    }
    fm.remote.add(f.path);
    if (f.content === undefined) {
      // A binary (asset). These carry generated, single-use names and are written
      // once, so there is no later edit to the same path to preserve.
      fm.dirty.delete(f.path);
      continue;
    }
    fm.baseText.set(f.path, f.content);
    if (fm.text.get(f.path) === f.content) {
      fm.dirty.delete(f.path);
    }
    // else: changed since the payload was built — leave it dirty for the next push.
  }
}

/** What a merge left behind: the messages worth showing, and whether any file in
 *  the map actually changed (so the caller knows to re-parse). */
export interface MergeOutcome {
  conflicts: string[];
  merged: boolean;
}

/** Three-way merge every dirty text file against the branch, in place.
 *
 *  A commit writes whole files, so pushing the local copy of a file the other
 *  instance also changed would drop its edits without a trace. Base is what this
 *  instance loaded (see FileMap.baseText); the merged content is left in the map
 *  for the push to commit. Records added on either side survive; one changed on
 *  both keeps the local version and is reported as a conflict.
 *
 *  Binaries (assets) carry generated, single-use names, so there is nothing to
 *  reconcile — the local bytes stand. */
export function mergeRemoteInto(fm: FileMap, remoteText: Record<string, string>): MergeOutcome {
  const conflicts: string[] = [];
  let merged = false;
  for (const path of [...fm.dirty]) {
    if (fm.binary.has(path)) {
      continue;
    }
    const deletedHere = fm.deleted.has(path);
    const local = deletedHere ? undefined : fm.text.get(path);
    const remote = remoteText[path];
    const base = fm.baseText.get(path);
    // Nothing to reconcile unless the branch moved this file away from the
    // version the local edits were made on.
    if (remote === base) {
      continue;
    }
    const result = mergeFile(path, { base, local, remote });
    conflicts.push(...result.conflicts);
    // The merge resolved against this remote version, so that's the ancestor the
    // next merge of this file has to compare against.
    if (remote !== undefined) {
      fm.baseText.set(path, remote);
    } else {
      fm.baseText.delete(path);
    }
    if (result.text === local) {
      continue;
    }
    merged = true;
    if (result.text === undefined) {
      fm.text.delete(path);
      fm.deleted.add(path);
    } else {
      fm.text.set(path, result.text);
      fm.deleted.delete(path);
    }
    fm.dirty.add(path);
  }
  return { conflicts, merged };
}
