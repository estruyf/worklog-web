// Meeting edits: create, update and delete a block in `meetings/<YYYY-MM>.md`, and
// turn one of its action items into a task. Called by the data layer on the
// user's behalf; nothing below this ring knows the file exists.
//
// A meeting is rewritten whole on every edit, the way a task block is: it is one
// record with one key, and the merge reconciles it as one.

import { Store } from '../store';
import type { Meeting, MeetingAction, Task } from '../model/types';
import { GENERAL_TODO_CLIENT_ID } from '../model/todos';
import { newMeetingId } from '../parser/ids';
import { normalizeTime, removeMeeting, splitPeople, upsertMeeting } from '../parser/meetingParser';
import { ensureDir, readText, writeText } from '../workspace/paths';
import { isValidISODate, monthOf } from '../util/date';
import { createTask } from './tasks';

export interface NewMeetingInput {
  date: string;
  time?: string;
  clientId?: string;
  title?: string;
  people?: string[];
}

/** What an edit may change. `null` clears an optional field; absent leaves it. */
export interface MeetingFields {
  title?: string;
  date?: string;
  time?: string | null;
  duration?: number | null;
  clientId?: string | null;
  people?: string[];
  notes?: string;
  actions?: MeetingAction[];
}

export async function createMeeting(store: Store, input: NewMeetingInput): Promise<Meeting> {
  if (!isValidISODate(input.date)) {
    throw new Error('A meeting needs a date.');
  }
  const meeting: Meeting = {
    id: newMeetingId(),
    title: oneLine(input.title ?? '') || 'Meeting',
    date: input.date,
    time: input.time ? normalizeTime(input.time) : undefined,
    clientId: input.clientId || undefined,
    people: cleanPeople(input.people ?? []),
    notes: '',
    actions: [],
    sourceFile: '',
    sourceLine: 0,
  };
  await write(store, meeting);
  await store.rebuild('addMeeting');
  return meeting;
}

export async function updateMeeting(store: Store, id: string, fields: MeetingFields): Promise<void> {
  const current = find(store, id);
  if (fields.date !== undefined && !isValidISODate(fields.date)) {
    throw new Error('A meeting needs a date.');
  }
  const next: Meeting = {
    ...current,
    title: fields.title === undefined ? current.title : oneLine(fields.title) || current.title,
    date: fields.date ?? current.date,
    time: fields.time === undefined ? current.time : fields.time ? normalizeTime(fields.time) : undefined,
    duration:
      fields.duration === undefined
        ? current.duration
        : fields.duration && fields.duration > 0
          ? Math.round(fields.duration)
          : undefined,
    clientId: fields.clientId === undefined ? current.clientId : fields.clientId || undefined,
    people: fields.people === undefined ? current.people : cleanPeople(fields.people),
    notes: fields.notes ?? current.notes,
    actions: fields.actions === undefined ? current.actions : cleanActions(fields.actions),
  };
  // A new date in another month moves the block, the way archiving moves a task:
  // the month file a meeting sits in is decided by its date and nothing else.
  const target = store.ws.meetingsFile(monthOf(next.date));
  if (target !== current.sourceFile) {
    await remove(store, current);
  }
  await write(store, next);
  await store.rebuild('updateMeeting');
}

export async function deleteMeeting(store: Store, id: string): Promise<void> {
  await remove(store, find(store, id));
  await store.rebuild('deleteMeeting');
}

/** Turn action item `index` into a task on the meeting's client — or a general
 *  to-do when the meeting has none, or names a client that is gone or archived —
 *  and write the task's id onto the item. An item already linked is left alone:
 *  a second click must not mint a second task. */
export async function createTaskFromAction(store: Store, meetingId: string, index: number): Promise<Task | undefined> {
  const meeting = find(store, meetingId);
  const action = meeting.actions[index];
  if (!action || action.taskId) {
    return undefined;
  }
  const client = store.db.getClients().find((c) => c.id === meeting.clientId && !c.archived);
  const task = await createTask(store, { title: action.text, clientId: client?.id ?? GENERAL_TODO_CLIENT_ID });
  // Re-read: creating the task rebuilt the db, and the meeting's own record is
  // what the write below has to start from.
  const fresh = find(store, meetingId);
  const actions = fresh.actions.map((a, i) => (i === index ? { ...a, taskId: task.id } : a));
  await write(store, { ...fresh, actions });
  await store.rebuild('linkMeetingTask');
  return task;
}

function find(store: Store, id: string): Meeting {
  const meeting = store.db.getMeeting(id);
  if (!meeting) {
    throw new Error('That meeting no longer exists — it may have been deleted on another device.');
  }
  return meeting;
}

async function write(store: Store, meeting: Meeting): Promise<void> {
  const month = monthOf(meeting.date);
  const uri = store.ws.meetingsFile(month);
  await ensureDir(store.ws.meetingsDir);
  await writeText(uri, upsertMeeting(await readText(uri), month, meeting));
}

/** Take a meeting's block out of the file it was read from. The file stays even
 *  when it empties — the same choice `upsertDayNote` makes, and for its reason. */
async function remove(store: Store, meeting: Meeting): Promise<void> {
  await writeText(meeting.sourceFile, removeMeeting((await readText(meeting.sourceFile)) ?? '', meeting.id));
}

/** One line of text, as a `## ` heading or a checkbox item has to be. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** A name can't carry a comma — it is the separator on the `- people:` line. */
function cleanPeople(people: string[]): string[] {
  return splitPeople(people.map((p) => oneLine(p.replace(/,/g, ' '))).join(','));
}

function cleanActions(actions: MeetingAction[]): MeetingAction[] {
  return actions
    .map((a) => ({ ...a, text: oneLine(a.text) }))
    .filter((a) => a.text !== '');
}
