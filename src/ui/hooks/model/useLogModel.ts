// The worklog ledger: what was logged on a day, and the "log time" form that
// adds, edits and removes an entry.

import { useCallback } from "react";
import type { Client, WorklogEntry } from "../../../model/types";
import { eventTypeFromClientId, eventWorklogClientId, isEventWorklogClientId } from "../../../model/worklog";
import { worklogStore } from "../../../data/worklogStore";
import type { LogState } from "../../model";
import type { WorklogUiState } from "../useWorklogUiState";

export function useLogModel(
  worklog: WorklogEntry[],
  clients: Client[],
  hoursPerDay: number,
  selectedDate: string,
  ui: WorklogUiState,
) {
  const { setLogOpen, setLogEditing, setLogIsEvent, setLogEventType, setLogClient, setLogType, setLogHours, setLogNote } = ui;

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

  const openLogForm = () => {
    setLogIsEvent(false);
    setLogEventType("vacation");
    setLogClient(clients[0]?.id || "");
    setLogType("full");
    setLogHours(2);
    setLogNote("");
    setLogEditing(false);
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
    setLogType(h >= hoursPerDay ? "full" : h === hoursPerDay / 2 ? "half" : "hours");
    setLogHours(h);
    setLogNote(entry?.note ?? "");
    setLogEditing(true);
    setLogOpen(true);
  };

  const saveLog = () => {
    // Guards the case where every client is archived: without a client id the
    // ledger line would serialise hollow.
    if (!ui.logIsEvent && !ui.logClient) {
      return;
    }
    const hours =
      ui.logType === "full" ? hoursPerDay : ui.logType === "half" ? hoursPerDay / 2 : parseFloat(String(ui.logHours)) || 0;
    if (ui.logIsEvent) {
      worklogStore.setEventWorklog(selectedDate, ui.logEventType, hours, ui.logNote.trim() || undefined);
    } else {
      worklogStore.setWorklog(selectedDate, ui.logClient, hours, ui.logNote.trim() || undefined);
    }
    setLogOpen(false);
    setLogEditing(false);
  };

  const removeLog = () => {
    const targetId = ui.logIsEvent ? eventWorklogClientId(ui.logEventType) : ui.logClient;
    worklogStore.removeWorklog(selectedDate, targetId);
    setLogOpen(false);
    setLogEditing(false);
  };

  // The form's state, bundled from the individual UI-state fields so the Today
  // view can treat it as one value with one setter.
  const logState: LogState = {
    open: ui.logOpen,
    editing: ui.logEditing,
    isEvent: ui.logIsEvent,
    eventType: ui.logEventType,
    client: ui.logClient,
    type: ui.logType,
    hours: ui.logHours,
    note: ui.logNote,
  };

  const setLogState = (next: LogState) => {
    setLogOpen(next.open);
    setLogEditing(next.editing);
    setLogIsEvent(next.isEvent);
    setLogEventType(next.eventType);
    setLogClient(next.client);
    setLogType(next.type);
    setLogHours(next.hours);
    setLogNote(next.note);
  };

  return { typeLabel, logsFor, openLogForm, editLog, saveLog, removeLog, logState, setLogState };
}
