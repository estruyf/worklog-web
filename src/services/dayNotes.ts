// Day-note edits: write or clear one day's freeform Markdown in
// `notes/<month>.md`. Called by the data layer on the user's behalf; nothing
// below this ring knows the file exists.

import { Store } from '../store';
import { upsertDayNote } from '../parser/dayNotes';
import { readText, writeText, ensureDir } from '../workspace/paths';
import { monthOf } from '../util/date';

/** Set the note for `date`, or clear it when `body` is blank. One reason for
 *  both: clearing a note is editing it, and the auto-sync event list is meant to
 *  read like something a person would tick, not like a service's call graph. */
export async function setDayNote(store: Store, date: string, body: string): Promise<void> {
  const month = monthOf(date);
  const uri = store.ws.notesFile(month);
  const existing = await readText(uri);
  if (existing === undefined && body.trim() === '') {
    return;
  }
  await ensureDir(store.ws.notesDir);
  await writeText(uri, upsertDayNote(existing, month, date, body));
  await store.rebuild('setDayNote');
}
