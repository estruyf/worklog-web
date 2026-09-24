// What has been typed into an open meeting but not yet saved.
//
// A third device-side record, and deliberately neither of the two halves in
// `repoCache` / `pendingStore`: both of those are *the repo* — the branch as it
// was last seen, and edits already written into the file map on their way to
// GitHub. A draft is neither. It has never been written into the file map, so
// the merge has nothing to reconcile it against and a sync must not carry it.
//
// It exists so the meeting editor's Save button can be honest in both
// directions: nothing reaches Markdown until it is pressed, and closing the lid
// mid-meeting still doesn't cost the notes. Pressing Save writes the draft
// through `updateMeeting` and drops the record — from then on the edit is the
// file map's business, and the usual auto-sync carries it.
//
// Best-effort like the rest of `data/idb`: no usable IndexedDB resolves quietly.

import type { MeetingFields } from '../services/meetings';
import { DRAFT_STORE, openDb, withStore } from './idb';

/** One unsaved meeting. The fields are exactly what `updateMeeting` takes, so
 *  saving is a hand-off rather than a translation. */
export interface MeetingDraft {
  /** `${repoKey}::${meetingId}` — the object-store key. */
  key: string;
  repoKey: string;
  meetingId: string;
  /** Epoch millis the draft was last written, for the editor's "kept from …". */
  savedAt: number;
  fields: MeetingFields;
}

function keyOf(repoKey: string, meetingId: string): string {
  return `${repoKey}::${meetingId}`;
}

export async function saveMeetingDraft(repoKey: string, meetingId: string, fields: MeetingFields): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  const draft: MeetingDraft = { key: keyOf(repoKey, meetingId), repoKey, meetingId, savedAt: Date.now(), fields };
  await withStore(db, DRAFT_STORE, 'readwrite', undefined, (store) => {
    store.put(draft);
  });
  db.close();
}

export async function loadMeetingDraft(repoKey: string, meetingId: string): Promise<MeetingDraft | null> {
  const db = await openDb();
  if (!db) {
    return null;
  }
  const draft = await withStore<MeetingDraft | null>(db, DRAFT_STORE, 'readonly', null, (store, done) => {
    const req = store.get(keyOf(repoKey, meetingId));
    req.onsuccess = () => done((req.result as MeetingDraft | undefined) ?? null);
  });
  db.close();
  return draft;
}

/** Drop a draft: it has been saved into the file map, or its meeting is gone. */
export async function clearMeetingDraft(repoKey: string, meetingId: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    return;
  }
  await withStore(db, DRAFT_STORE, 'readwrite', undefined, (store) => {
    store.delete(keyOf(repoKey, meetingId));
  });
  db.close();
}
