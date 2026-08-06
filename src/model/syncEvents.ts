// The change kinds automatic sync can react to.
//
// Every mutation ends in `store.rebuild(reason)` with a name of the service's
// own choosing ("addTask", "setStatus", "toggleWorked", …). Those names are an
// implementation detail — they get renamed when a service is refactored, and
// there are twenty of them. This module maps them onto the handful of events a
// person would actually tick in Settings, so `.worklog/config.json` records
// "taskCreated" rather than whichever internal reason happened to be current.
//
// Pure: no I/O, no React. The data layer asks `syncsOnChange`, the settings view
// renders `AUTO_SYNC_EVENTS`.

/** A user-facing change kind that can trigger an immediate sync. */
export type AutoSyncEvent = 'taskCreated' | 'taskStatus' | 'taskEdited' | 'timeLogged' | 'settings' | 'dayNote';

export interface AutoSyncEventDef {
  id: AutoSyncEvent;
  label: string;
  description: string;
}

/** The events offered in Settings, in the order they are shown. */
export const AUTO_SYNC_EVENTS: AutoSyncEventDef[] = [
  {
    id: 'taskCreated',
    label: 'A task or to-do is created',
    description: 'A new task, subtask or general to-do.',
  },
  {
    id: 'taskStatus',
    label: 'A task changes state',
    description: 'Status changed, marked done or worked on, reopened, completion date changed.',
  },
  {
    id: 'taskEdited',
    label: 'A task is edited or deleted',
    description: 'Title, due date, links, tags, description, task notes, recurrence, parent — or a deletion.',
  },
  {
    id: 'timeLogged',
    label: 'Time is logged',
    description: 'An entry in the day view’s log form is added, changed or removed.',
  },
  {
    id: 'settings',
    label: 'Clients, statuses or settings change',
    description:
      'A client or task status is added, edited, reordered or removed, or these settings are saved.',
  },
  // Appended, not slotted in beside the other edit events: `parseAutoSyncEvents`
  // orders a saved array by this list, so an insertion in the middle rewrites
  // every existing config's `events` on its next save for no reason.
  {
    id: 'dayNote',
    label: 'A day note is saved',
    description: 'The freeform Markdown written on a day, saved or cleared from the day view.',
  },
];

/** Rebuild reason → the event it counts as. A reason absent here never triggers a
 *  sync of its own: `pull`, `merge`, `open` and `restore` are the sync machinery
 *  itself, and syncing in response to them would chase its own tail. */
const REASON_EVENT: Record<string, AutoSyncEvent> = {
  addTask: 'taskCreated',

  setStatus: 'taskStatus',
  toggleWorked: 'taskStatus',
  closeTask: 'taskStatus',
  reopenTask: 'taskStatus',
  undoOccurrence: 'taskStatus',
  setCompletedDate: 'taskStatus',

  updateTask: 'taskEdited',
  deleteTask: 'taskEdited',
  addNote: 'taskEdited',
  deleteNote: 'taskEdited',
  setRecurrence: 'taskEdited',
  setParent: 'taskEdited',

  setWorklog: 'timeLogged',
  removeWorklog: 'timeLogged',

  setDayNote: 'dayNote',

  addClient: 'settings',
  updateClient: 'settings',
  archiveClient: 'settings',
  restoreClient: 'settings',
  deleteClient: 'settings',
  updateSettings: 'settings',
  addStatus: 'settings',
  updateStatus: 'settings',
  moveStatus: 'settings',
  deleteStatus: 'settings',
};

/** The event a rebuild reason counts as, or undefined when it counts as none. */
export function autoSyncEventFor(reason: string): AutoSyncEvent | undefined {
  return REASON_EVENT[reason];
}

/** True when a change made for `reason` should sync straight away. */
export function syncsOnChange(events: AutoSyncEvent[], reason: string): boolean {
  const event = autoSyncEventFor(reason);
  return event !== undefined && events.includes(event);
}

/** Normalize a config `autoSync.events` array: unknown ids dropped, duplicates
 *  collapsed, and the result ordered as {@link AUTO_SYNC_EVENTS} is, so config.json
 *  doesn't churn on the order the checkboxes happened to be ticked in. */
export function parseAutoSyncEvents(value: unknown): AutoSyncEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const wanted = new Set(value);
  return AUTO_SYNC_EVENTS.filter((e) => wanted.has(e.id)).map((e) => e.id);
}
