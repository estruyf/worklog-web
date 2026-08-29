// Checklist edits: create, rename and delete `lists/<id>.md`, and the item-level
// writes the list view makes. Called by the data layer on the user's behalf;
// nothing below this ring knows the file exists.
//
// Every write here re-reads the file and goes through the line editors in
// `parser/checklistParser`, so an edit touches exactly the line it means to and
// leaves the prose, the nesting and the ordering a person wrote alone.

import { Store } from '../store';
import {
  addChecklistItem,
  addChecklistSection,
  newChecklistFile,
  parseChecklistFile,
  removeChecklistItem,
  removeChecklistSection,
  renameChecklist,
  renameChecklistSection,
  resetChecklist,
  setChecklistItemDone,
  setChecklistItemText,
} from '../parser/checklistParser';
import { uniqueChecklistId, type Checklist } from '../model/checklist';
import { deleteFile, ensureDir, readText, writeText } from '../workspace/paths';

/** Create an empty list and return it. The id comes from the name and is made
 *  unique against the lists already there, so two "Packing" lists are two files
 *  rather than one overwriting the other. */
export async function createChecklist(store: Store, name: string): Promise<Checklist | undefined> {
  const title = name.trim();
  if (!title) {
    return undefined;
  }
  const taken = store.db.getAllChecklists().map((l) => l.id);
  const id = uniqueChecklistId(title, taken);
  await ensureDir(store.ws.listsDir);
  await writeText(store.ws.listFile(id), newChecklistFile(title));
  await store.rebuild('createChecklist');
  return store.db.getAllChecklists().find((l) => l.id === id);
}

/** Rename a list. The `# ` heading is the name; the id (and so the filename)
 *  stays put — it is what every other reference would have to follow, and a
 *  rename is not a reason to move a file out from under a synced branch. */
export async function renameChecklistById(store: Store, id: string, name: string): Promise<void> {
  const title = name.trim();
  if (!title) {
    return;
  }
  await edit(store, id, 'renameChecklist', (content) => renameChecklist(content, title));
}

export async function deleteChecklist(store: Store, id: string): Promise<void> {
  await deleteFile(store.ws.listFile(id));
  await store.rebuild('deleteChecklist');
}

/** Tick an item off, or put it back. */
export async function setChecklistItem(store: Store, id: string, line: number, done: boolean): Promise<void> {
  await edit(store, id, 'setChecklistItem', (content) => setChecklistItemDone(content, line, done));
}

export async function renameChecklistItem(store: Store, id: string, line: number, text: string): Promise<void> {
  const words = text.trim();
  if (!words) {
    return;
  }
  await edit(store, id, 'renameChecklistItem', (content) => setChecklistItemText(content, line, words));
}

export async function deleteChecklistItem(store: Store, id: string, line: number): Promise<void> {
  await edit(store, id, 'deleteChecklistItem', (content) => removeChecklistItem(content, line));
}

/** Add an item to the end of one section. The section is named by index because
 *  that is what the view has: two `## Bike` headings in one file are two
 *  sections, and adding to "the second one" is a thing a user can mean. */
export async function addChecklistItemTo(
  store: Store,
  id: string,
  sectionIndex: number,
  text: string,
): Promise<void> {
  const words = text.trim();
  if (!words) {
    return;
  }
  await edit(store, id, 'addChecklistItem', (content, list) => addChecklistItem(content, list, sectionIndex, words));
}

/** Start a new group at the end of the list. */
export async function addChecklistSectionTo(store: Store, id: string, title: string): Promise<void> {
  const words = title.trim();
  if (!words) {
    return;
  }
  await edit(store, id, 'addChecklistSection', (content) => addChecklistSection(content, words));
}

export async function renameChecklistSectionAt(store: Store, id: string, line: number, title: string): Promise<void> {
  const words = title.trim();
  if (!words) {
    return;
  }
  await edit(store, id, 'renameChecklistSection', (content) => renameChecklistSection(content, line, words));
}

/** Remove a group and the items under it. */
export async function deleteChecklistSection(store: Store, id: string, line: number): Promise<void> {
  await edit(store, id, 'deleteChecklistSection', (content) => removeChecklistSection(content, line));
}

/** Start the list over: untick everything and stamp the day the run just
 *  finished. See `resetChecklist` for why the date is the end and not the start. */
export async function startChecklistAgain(store: Store, id: string, date: string): Promise<void> {
  await edit(store, id, 'startChecklistAgain', (content) => resetChecklist(content, date));
}

/** Read the file, apply a line edit, write it back and rebuild. A list that
 *  isn't there is a no-op rather than an error: the only way to reach one of
 *  these is from a list on screen, and a deleted file has already re-rendered. */
async function edit(
  store: Store,
  id: string,
  reason: string,
  apply: (content: string, list: Checklist) => string,
): Promise<void> {
  const uri = store.ws.listFile(id);
  const content = await readText(uri);
  if (content === undefined) {
    return;
  }
  const next = apply(content, parseChecklistFile(content, uri, id));
  if (next === content) {
    return;
  }
  await writeText(uri, next);
  await store.rebuild(reason);
}
