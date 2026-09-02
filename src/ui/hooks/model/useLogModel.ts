// The worklog ledger: what was logged on a day, and the "log time" form that
// adds, edits and removes an entry. The day view draws the same entries as one
// proportional bar (see ui/utils/dayBar), which is where the form is opened from.

import { useCallback } from "react";
import type { Client, WorklogEntry } from "../../../model/types";
import { eventTypeFromClientId, eventWorklogClientId, isEventWorklogClientId } from "../../../model/worklog";
import { worklogStore } from "../../../data/worklogStore";
import type { LogState } from "../../model";
import { roundHours } from "../../utils";
import type { WorklogUiState } from "../useWorklogUiState";

export function useLogModel(
  worklog: WorklogEntry[],
  clients: Client[],
  hoursPerDay: number,
  selectedDate: string,
  ui: WorklogUiState,
) {
  const { setLogOpen, setLogEditingClientId, setLogIsEvent, setLogEventType, setLogClient, setLogType, setLogHours, setLogNote } =
    ui;

  /** Which amount button an hours figure lands on. */
  const typeOf = useCallback(
    (h: number): string => (h >= hoursPerDay ? "full" : h === hoursPerDay / 2 ? "half" : "hours"),
    [hoursPerDay],
  );

  /** How a number of hours reads on a chip: a full day, a half day, or "6h". */
  const typeLabel = useCallback(
    (h: number): string => {
      if (h >= hoursPerDay) {
        return "full day";
      }
      if (h === hoursPerDay / 2) {
        return "½ day";
      }
      return h + "h";
    },
    [hoursPerDay],
  );

  const logsFor = useCallback((date: string) => worklog.filter((w) => w.date === date), [worklog]);

  const closeLogForm = useCallback(() => {
    setLogOpen(false);
    setLogEditingClientId("");
  }, [setLogOpen, setLogEditingClientId]);

  /** Open the form on a new entry. `prefillHours` is what the unlogged slot on the
   *  day bar is worth, so clicking the gap opens the form on exactly the gap. */
  const openLogForm = (prefillHours?: number) => {
    const logged = new Set(logsFor(selectedDate).map((l) => l.clientId));
    // Logging a client that already has a line replaces it, so the form opens on
    // one that doesn't — adding a second entry is the reason you are here.
    const client = clients.find((c) => !logged.has(c.id)) ?? clients[0];
    const prefill = roundHours(typeof prefillHours === "number" && prefillHours > 0 ? prefillHours : hoursPerDay || 1);
    setLogIsEvent(false);
    setLogEventType("vacation");
    setLogClient(client?.id || "");
    setLogType(typeOf(prefill));
    setLogHours(prefill);
    setLogNote("");
    setLogEditingClientId("");
    setLogOpen(true);
  };

  /** Open the form on the entry already logged for `cid` on the selected day. */
  const editLog = (cid: string) => {
    const entry = logsFor(selectedDate).find((l) => l.clientId === cid);
    const h = entry ? entry.hours : 2;
    const isEvent = isEventWorklogClientId(cid);
    setLogIsEvent(isEvent);
    setLogEventType(eventTypeFromClientId(cid) || "vacation");
    setLogClient(isEvent ? clients[0]?.id || "" : cid);
    setLogType(typeOf(h));
    setLogHours(h);
    setLogNote(entry?.note ?? "");
    setLogEditingClientId(cid);
    setLogOpen(true);
  };

  const saveLog = async () => {
    // Guards the case where every client is archived: without a client id the
    // ledger line would serialise hollow.
    const target = ui.logIsEvent ? eventWorklogClientId(ui.logEventType) : ui.logClient;
    if (!target) {
      return;
    }
    const hours =
      ui.logType === "full"
        ? hoursPerDay
        : ui.logType === "half"
          ? hoursPerDay / 2
          : roundHours(Math.max(0, parseFloat(String(ui.logHours)) || 0));
    const note = ui.logNote.trim() || undefined;
    const from = ui.logEditingClientId;
    closeLogForm();
    // Re-pointing an edit at another client *moves* the entry: the ledger is
    // keyed by (date, client), so the line it started on has to go or the day
    // quietly gains those hours back. Awaited, because both writes read and
    // rewrite the same month file.
    if (from && from !== target) {
      await worklogStore.removeWorklog(selectedDate, from);
    }
    await worklogStore.setWorklog(selectedDate, target, hours, note);
  };

  const removeLog = async () => {
    const target = ui.logEditingClientId || (ui.logIsEvent ? eventWorklogClientId(ui.logEventType) : ui.logClient);
    closeLogForm();
    if (target) {
      await worklogStore.removeWorklog(selectedDate, target);
    }
  };

  /** Log the same entry on a run of days — the calendar's range selection. One
   *  read/write per month file rather than per day, so a fortnight of vacation is
   *  one rebuild and one commit instead of fourteen. */
  const logRange = async (dates: string[], clientId: string, hours: number, note?: string) => {
    if (dates.length === 0) {
      return;
    }
    await worklogStore.setWorklogRange(dates, clientId, hours, note);
    worklogStore.notify({ message: `Logged ${dates.length} ${dates.length === 1 ? "day" : "days"}`, tone: "success" });
  };

  /** Copy another day's entries onto the selected one — the one-click path for
   *  "same clients, same split as yesterday". Notes are left behind: they say
   *  what was worked on that day, which is exactly what this doesn't know. */
  const copyDayLogs = async (fromDate: string) => {
    for (const entry of logsFor(fromDate)) {
      await worklogStore.setWorklog(selectedDate, entry.clientId, entry.hours);
    }
  };

  // The form's state, bundled from the individual UI-state fields so the day view
  // can treat it as one value with one setter.
  const logState: LogState = {
    open: ui.logOpen,
    editingClientId: ui.logEditingClientId,
    isEvent: ui.logIsEvent,
    eventType: ui.logEventType,
    client: ui.logClient,
    type: ui.logType,
    hours: ui.logHours,
    note: ui.logNote,
  };

  const setLogState = (next: LogState) => {
    setLogOpen(next.open);
    setLogEditingClientId(next.editingClientId);
    setLogIsEvent(next.isEvent);
    setLogEventType(next.eventType);
    setLogClient(next.client);
    setLogType(next.type);
    setLogHours(next.hours);
    setLogNote(next.note);
  };

  return {
    typeLabel,
    logsFor,
    openLogForm,
    editLog,
    saveLog,
    removeLog,
    logRange,
    copyDayLogs,
    closeLogForm,
    logState,
    setLogState,
  };
}
