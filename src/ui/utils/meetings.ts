// Pure meeting derivations for the views: whether an action item is finished,
// the meeting that came before this one, and the Meetings list's filter. Kept
// free of React so they can be tested directly.

import type { Meeting, MeetingAction, Task } from '../../model/types';
import { isDone } from './task';

/** An item that became a task is finished when its task is — the task is where
 *  the work is tracked now, and its checkbox in the Markdown is left as it was
 *  written rather than rewritten behind the user's back. A link to a task that no
 *  longer exists falls back to the item's own box. */
export function isActionDone(action: MeetingAction, taskById: ReadonlyMap<string, Task>): boolean {
  const task = action.taskId ? taskById.get(action.taskId) : undefined;
  return task ? isDone(task) : action.done;
}

/** How many of a meeting's action items are still open. */
export function openActionCount(meeting: Meeting, taskById: ReadonlyMap<string, Task>): number {
  return meeting.actions.filter((a) => !isActionDone(a, taskById)).length;
}

/** The last meeting with the same client before this one — what you want in
 *  front of you walking into the next. `meetings` is most-recent-first, the order
 *  the snapshot holds them in. */
export function previousMeeting(meetings: readonly Meeting[], meeting: Meeting): Meeting | undefined {
  if (!meeting.clientId) {
    return undefined;
  }
  const key = `${meeting.date} ${meeting.time ?? ''}`;
  return meetings.find(
    (m) => m.id !== meeting.id && m.clientId === meeting.clientId && `${m.date} ${m.time ?? ''}` < key,
  );
}

export interface MeetingFilters {
  /** Client id, or '' for every client. */
  client: string;
  /** A name from the people lists, or '' for anyone. Matched case-insensitively. */
  person: string;
  query: string;
}

/** The Meetings list's narrowing. The query reads the title, the people, the
 *  notes and the action items: a meeting is looked up by what was said in it as
 *  often as by what it was called. */
export function filterMeetings(meetings: readonly Meeting[], filters: MeetingFilters): Meeting[] {
  const person = filters.person.toLowerCase();
  const q = filters.query.trim().toLowerCase();
  return meetings.filter(
    (m) =>
      (!filters.client || m.clientId === filters.client) &&
      (!person || m.people.some((p) => p.toLowerCase() === person)) &&
      (!q ||
        m.title.toLowerCase().includes(q) ||
        m.notes.toLowerCase().includes(q) ||
        m.people.some((p) => p.toLowerCase().includes(q)) ||
        m.actions.some((a) => a.text.toLowerCase().includes(q))),
  );
}
