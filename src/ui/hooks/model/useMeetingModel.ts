// Meeting notes: starting one from wherever you are, the edits, and the lookups
// the other views need — who you have met, and which meeting a task came out of. The meetings themselves come straight off the
// snapshot; there is nothing to derive about one beyond what its block says.

import { useCallback, useMemo } from "react";
import { worklogStore } from "../../../data/worklogStore";
import type { Meeting, Task } from "../../../model/types";
import type { MeetingFields } from "../../../services/meetings";
import { isGeneralTodoClientId } from "../../../model/todos";
import { nowStamp } from "../../../util/date";
import { closeMeeting, navigateToMeeting } from "../../router";
import { clientIdOf } from "../../utils";
import type { WorklogUiState } from "../useWorklogUiState";

/** Where a new meeting starts, when the caller knows better than the context. */
export interface MeetingSeed {
  date?: string;
  clientId?: string;
}

/** The current time rounded down to five minutes — a meeting "at 10:03" is the
 *  10:00 one that started late, and the round number is what you'd write. */
function roundedNow(): string {
  const [h, m] = nowStamp().slice(11, 16).split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m - (m % 5)).padStart(2, "0")}`;
}

export function useMeetingModel(
  meetings: Meeting[],
  tasks: Task[],
  today: string,
  clientName: (id: string) => string,
  ui: WorklogUiState,
) {
  const { ask } = ui.confirm;
  const { view, selectedDate, selectedClient, detailId } = ui;

  /** Everyone you have met, most recently seen first, once each. */
  const knownPeople = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of meetings) {
      for (const p of m.people) {
        if (!seen.has(p.toLowerCase())) {
          seen.set(p.toLowerCase(), p);
        }
      }
    }
    return [...seen.values()];
  }, [meetings]);

  /** Tasks by id, for resolving an action item's `→ t_…` to the task it became. */
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  /** The task → the meeting whose action item it was made from. */
  const meetingOfTask = useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const m of meetings) {
      for (const a of m.actions) {
        if (a.taskId) {
          map.set(a.taskId, m);
        }
      }
    }
    return map;
  }, [meetings]);

  const startMeeting = useCallback(
    async (seed: MeetingSeed = {}) => {
      const date = seed.date || today;
      const clientId = seed.clientId || undefined;
      // The people from the last meeting with this client: a recurring meeting is
      // most meetings, and the list is quicker to trim than to type.
      const last = clientId ? meetings.find((m) => m.clientId === clientId) : undefined;
      const created = await worklogStore.createMeeting({
        date,
        // Only today has a "now". A meeting logged against another day gets its
        // time when someone knows it.
        time: date === today ? roundedNow() : undefined,
        clientId,
        title: clientId ? `${clientName(clientId)} meeting` : "Meeting",
        people: last?.people ?? [],
      });
      if (created) {
        navigateToMeeting(created.id);
      }
    },
    [meetings, today, clientName],
  );

  /** The shortcut and the sidebar button: the client is the one on screen — the
   *  open task's, or the one picked in Clients — and the day is the one the Day
   *  view is showing. Anywhere else it is today, with no client yet. */
  const startMeetingInContext = useCallback(() => {
    const task = detailId ? tasks.find((t) => t.id === detailId) : undefined;
    const taskClient = task && !isGeneralTodoClientId(clientIdOf(task)) ? clientIdOf(task) : undefined;
    return startMeeting({
      date: view === "day" ? selectedDate : today,
      clientId: taskClient ?? (view === "clients" && !detailId ? selectedClient : undefined),
    });
  }, [detailId, tasks, view, selectedDate, selectedClient, today, startMeeting]);

  /** Write a meeting's draft into its Markdown block. Until this runs, what has
   *  been typed lives only in the device-side draft (`data/meetingDrafts`) — which
   *  is what lets the editor have a Save button without a closed lid costing
   *  anything. Saving is what arms auto-sync, under the `meeting` event. */
  const saveMeeting = useCallback((id: string, fields: MeetingFields) => worklogStore.saveMeeting(id, fields), []);

  const meetingDraft = useCallback((id: string) => worklogStore.meetingDraft(id), []);
  const saveMeetingDraft = useCallback((id: string, fields: MeetingFields) => worklogStore.saveMeetingDraft(id, fields), []);
  const discardMeetingDraft = useCallback((id: string) => worklogStore.discardMeetingDraft(id), []);

  /** The block is the only copy — the same reason deleting a task asks. */
  const deleteMeeting = useCallback(
    async (meeting: Meeting) => {
      const ok = await ask({
        title: `Delete “${meeting.title}”?`,
        message: "Its notes and action items go with it. Tasks made from its action items stay. This can't be undone here — only in Git.",
        confirmLabel: "Delete meeting",
        tone: "danger",
      });
      if (ok) {
        await worklogStore.deleteMeeting(meeting.id);
        closeMeeting();
      }
    },
    [ask],
  );

  const makeTaskFromAction = useCallback(
    (meeting: Meeting, index: number) => worklogStore.createTaskFromAction(meeting.id, index),
    [],
  );

  return {
    taskById,
    knownPeople,
    meetingOfTask,
    startMeeting,
    startMeetingInContext,
    saveMeeting,
    meetingDraft,
    saveMeetingDraft,
    discardMeetingDraft,
    deleteMeeting,
    makeTaskFromAction,
  };
}
