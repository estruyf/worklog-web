// The shared read-model + action layer over a live snapshot. Everything here is
// used by more than one view (or by the shell/modals), so it's built once in the
// provider and exposed through DataContext instead of prop-drilled. Per-view
// derivations (groups, monthly rolls, search) live in each view's own data hook.

import { useCallback, useMemo } from "react";
import type { Client, StatusDef, Task } from "../../model/types";
import {
  eventWorklogClientId,
  eventTypeFromClientId,
  formatEventTypeLabel,
  isEventWorklogClientId,
} from "../../model/worklog";
import {
  GENERAL_TODO_CLIENT_ID,
  GENERAL_TODO_COLOR,
  GENERAL_TODO_LABEL,
  isGeneralTodoClientId,
} from "../../model/todos";
import type { WorklogState } from "../state";
import { worklogStore, type ToastMessage } from "../../data/worklogStore";
import { navigateToTask } from "../router";
import type { StatusMetaFn, LogState, WorklogRow } from "../model";
import {
  PALETTE,
  clientIdOf,
  defaultTaskClientId,
  isDone,
  linksOf,
  workedOnDate,
  resolveStatusMeta,
} from "../utils";
import { useWorklogUiState } from "./useWorklogUiState";

type Ui = ReturnType<typeof useWorklogUiState>;

export function useWorklogModel(
  snap: WorklogState | null,
  ui: Ui,
  toast: ToastMessage | null,
  gitPending = false,
  loading = false,
) {
  const clients = snap?.clients ?? [];
  const tasks = snap?.tasks ?? [];
  const worklog = snap?.worklog ?? [];
  const statuses = snap?.statuses ?? [];
  const today = snap?.today ?? "";
  const hoursPerDay = snap?.hoursPerDay ?? 0;
  const weekStart = snap?.weekStart ?? 0;
  const autoSync = snap?.autoSync ?? { enabled: false, delayMinutes: 5 };
  const assetsBase = snap?.assetsBase ?? "";
  const { selectedDate } = ui;

  // O(1) lookups by id, rebuilt only when the snapshot's clients/statuses change.
  const clientById = useMemo(() => {
    const m = new Map<string, { client: Client; index: number }>();
    clients.forEach((c, i) => m.set(c.id, { client: c, index: i }));
    return m;
  }, [clients]);
  const statusById = useMemo(() => {
    const m = new Map<string, StatusDef>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

  const colorOf = useCallback(
    (id: string): string => {
      if (isGeneralTodoClientId(id)) {
        return GENERAL_TODO_COLOR;
      }
      const hit = clientById.get(id);
      const i = hit ? hit.index : -1;
      return (
        (i >= 0 && hit!.client.color) ||
        PALETTE[(i < 0 ? 0 : i) % PALETTE.length]
      );
    },
    [clientById],
  );
  const clientName = useCallback(
    (id: string): string =>
      clientById.get(id)?.client.name ??
      (isGeneralTodoClientId(id)
        ? GENERAL_TODO_LABEL
        : isEventWorklogClientId(id)
          ? formatEventTypeLabel(eventTypeFromClientId(id))
          : "?"),
    [clientById],
  );

  const nonTerminal = useMemo(
    () => statuses.filter((s) => !s.terminal),
    [statuses],
  );
  const firstStatusId = nonTerminal[0]?.id ?? statuses[0]?.id ?? "open";

  const statusMeta = useCallback<StatusMetaFn>(
    (statusId, done) =>
      resolveStatusMeta(statusById.get(statusId), statusId, done),
    [statusById],
  );
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
  const logsFor = useCallback(
    (date: string) => worklog.filter((w) => w.date === date),
    [worklog],
  );

  // ---- mutations (call the store directly) ----
  const cycleStatus = useCallback(
    (t: Task) => {
      if (nonTerminal.length === 0) {
        return;
      }
      const i = nonTerminal.findIndex((s) => s.id === t.status);
      const next = nonTerminal[(i + 1) % nonTerminal.length];
      worklogStore.setStatus(t.id, next.id);
    },
    [nonTerminal],
  );
  const markDone = useCallback(
    (t: Task) => worklogStore.closeTask(t.id, selectedDate),
    [selectedDate],
  );
  const toggleWorked = useCallback(
    (t: Task) => worklogStore.toggleWorked(t.id, selectedDate),
    [selectedDate],
  );
  const reopen = useCallback(
    (t: Task) => worklogStore.setStatus(t.id, firstStatusId),
    [firstStatusId],
  );
  const openDetail = useCallback((t: Task) => ui.setDetailId(t.id), []);

  const openEdit = useCallback((t: Task) => {
    ui.setEditingId(t.id);
    ui.setMTitle(t.title);
    ui.setMClient(clientIdOf(t));
    ui.setMParent(t.parentId || "");
    const ls = linksOf(t);
    ui.setMLinks(ls.length ? ls : [""]);
    ui.setMDue(t.due || "");
    ui.setMTags((t.tags ?? []).join(", "));
    ui.setMDescription(t.description || "");
    ui.setMDescMode(t.description ? "preview" : "edit");
    ui.setAddingClient(false);
    ui.setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => {
    ui.setModalOpen(false);
    ui.setEditingId(null);
    ui.setAddingClient(false);
  }, []);
  const deleteTask = useCallback(
    (id: string, options?: { permanent?: boolean }) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) {
        return;
      }

      const isPermanent = options?.permanent || isDone(t);
      const ok = isPermanent
        ? window.confirm(
            `Delete "${t.title}" forever? This also removes subtasks and cannot be undone.`,
          )
        : window.confirm(
            `Move "${t.title}" to archive? You can restore it later from Archive.`,
          );

      if (!ok) {
        return;
      }

      if (isPermanent) {
        worklogStore.deleteTask(id);
        if (ui.detailId === id) {
          ui.setDetailId(null);
        }
      } else {
        worklogStore.closeTask(id, selectedDate);
      }

      if (ui.modalOpen && ui.editingId === id) {
        closeModal();
      }
    },
    [tasks, ui.detailId, ui.modalOpen, ui.editingId, closeModal, selectedDate],
  );

  // ---- row builders ----
  const makeRow = useCallback(
    (t: Task, child: boolean): WorklogRow => {
      const ls = linksOf(t);
      // General to-dos are open or closed only: no worked-on marking and no
      // status to show or cycle through.
      const todo = isGeneralTodoClientId(clientIdOf(t));
      const m = todo ? undefined : statusMeta(t.status, isDone(t));
      const worked = !todo && workedOnDate(t, selectedDate);
      const children = tasks.filter((c) => c.parentId === t.id);
      const progress = children.length
        ? { done: children.filter(isDone).length, total: children.length }
        : undefined;
      return {
        id: t.id,
        title: t.title,
        pad: child ? "40px" : "10px",
        statusLabel: m?.label,
        statusColor: m?.color,
        worked,
        workedTitle: worked
          ? "Unmark worked on this day"
          : "Mark worked on this day",
        hasLink: ls.length > 0,
        link: ls[0] || "",
        due: t.due,
        overdue: !!t.due && !isDone(t) && t.due < today,
        tags: t.tags ?? [],
        progress,
        onView: () => openDetail(t),
        onOpenTab: () => navigateToTask(t.id),
        onDone: () => markDone(t),
        onWorked: todo ? undefined : () => toggleWorked(t),
        onCycle: todo ? undefined : () => cycleStatus(t),
        onEdit: () => openEdit(t),
        onDelete: () => deleteTask(t.id),
      };
    },
    [
      statusMeta,
      selectedDate,
      tasks,
      today,
      openDetail,
      markDone,
      toggleWorked,
      cycleStatus,
      openEdit,
      deleteTask,
    ],
  );
  const openRowsFor = useCallback(
    (list: Task[]): WorklogRow[] => {
      const rows: WorklogRow[] = [];
      const tops = list.filter((t) => !t.parentId);
      tops.forEach((t) => {
        rows.push(makeRow(t, false));
        list
          .filter((c) => c.parentId === t.id)
          .forEach((c) => rows.push(makeRow(c, true)));
      });
      list
        .filter((t) => t.parentId && !tops.find((p) => p.id === t.parentId))
        .forEach((c) => {
          if (!rows.find((r) => r.id === c.id)) {
            rows.push(makeRow(c, false));
          }
        });
      return rows;
    },
    [makeRow],
  );

  // ---- form / modal actions (only fired from the rendered shell & modals) ----
  const openModal = () => {
    ui.setEditingId(null);
    ui.setMTitle("");
    ui.setMClient(
      defaultTaskClientId({
        selectedClientId: ui.selectedClient,
        selectedDate,
        today,
        clients,
        worklog,
      }),
    );
    ui.setMParent("");
    ui.setMLinks([""]);
    ui.setMDue("");
    ui.setMTags("");
    ui.setMDescription("");
    ui.setMDescMode("edit");
    ui.setAddingClient(false);
    ui.setModalOpen(true);
  };
  // Open the new-task modal pre-seeded with a due date, e.g. from the calendar
  // when planning work for a future day.
  const openModalForDue = (due: string) => {
    openModal();
    ui.setMDue(due);
  };
  // Open the new-task modal pre-assigned to the general to-do bucket, so the
  // To-dos view can add straight to its own list.
  const openTodoModal = () => {
    openModal();
    ui.setMClient(GENERAL_TODO_CLIENT_ID);
  };
  const openChildModal = (parent: Task) => {
    ui.setEditingId(null);
    ui.setMTitle("");
    ui.setMClient(clientIdOf(parent));
    ui.setMParent(parent.id);
    ui.setMLinks([""]);
    ui.setMDue("");
    ui.setMTags("");
    ui.setMDescription("");
    ui.setMDescMode("edit");
    ui.setAddingClient(false);
    ui.setModalOpen(true);
  };
  const openModalFromShortcut = () => {
    const detailTask = ui.detailId
      ? tasks.find((t) => t.id === ui.detailId)
      : undefined;
    if (detailTask && !isDone(detailTask)) {
      openChildModal(detailTask);
      return;
    }
    openModal();
  };
  const saveTask = () => {
    const title = ui.mTitle.trim();
    if (!title || !ui.mClient) {
      return;
    }
    const links = ui.mLinks.map((l) => l.trim()).filter(Boolean);
    const due = ui.mDue.trim() || undefined;
    const tags = ui.mTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const description = ui.mDescription.trim();
    if (ui.editingId) {
      worklogStore.updateTask(ui.editingId, {
        title,
        clientId: ui.mClient,
        parentId: ui.mParent,
        links,
        description,
        due: due ?? "",
        tags,
      });
    } else {
      worklogStore.createTask({
        title,
        clientId: ui.mClient,
        parentId: ui.mParent || undefined,
        links,
        description: description || undefined,
        due,
        tags,
      });
    }
    closeModal();
  };
  const createClient = (name: string, target: "modal" | "selected") => {
    const n = name.trim();
    if (!n) {
      return;
    }
    ui.pendingClient.current = { name: n, target };
    worklogStore.createClient(n);
  };
  const addNote = useCallback((taskId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    worklogStore.addNote(taskId, trimmed);
  }, []);
  const deleteNote = useCallback((taskId: string, index: number) => {
    worklogStore.deleteNote(taskId, index);
  }, []);
  const saveDescription = () => {
    if (!ui.detailId) {
      return;
    }
    worklogStore.updateTask(ui.detailId, { description: ui.descDraft });
    ui.setDescMode("preview");
  };
  const openClientEditor = (c?: Client) => {
    ui.setEditingClientId(c?.id ?? null);
    ui.setCName(c?.name ?? "");
    ui.setCColor(c ? colorOf(c.id) : PALETTE[clients.length % PALETTE.length]);
    ui.setClientModalOpen(true);
  };
  const saveClient = () => {
    const name = ui.cName.trim();
    if (!name) {
      return;
    }
    if (ui.editingClientId) {
      worklogStore.updateClient(ui.editingClientId, { name, color: ui.cColor });
    } else {
      ui.pendingClient.current = { name, target: "selected" };
      worklogStore.createClient(name, ui.cColor);
    }
    ui.setClientModalOpen(false);
  };
  const openLogForm = () => {
    ui.setLogIsEvent(false);
    ui.setLogEventType("vacation");
    ui.setLogClient(clients[0]?.id || "");
    ui.setLogType("full");
    ui.setLogHours(2);
    ui.setLogNote("");
    ui.setLogEditing(false);
    ui.setLogOpen(true);
  };
  const editLog = (cid: string) => {
    const entry = logsFor(selectedDate).find((l) => l.clientId === cid);
    const h = entry ? entry.hours : 2;
    const isEvent = isEventWorklogClientId(cid);
    ui.setLogIsEvent(isEvent);
    ui.setLogEventType(eventTypeFromClientId(cid) || "vacation");
    ui.setLogClient(isEvent ? clients[0]?.id || "" : cid);
    ui.setLogType(
      h >= hoursPerDay ? "full" : h === hoursPerDay / 2 ? "half" : "hours",
    );
    ui.setLogHours(h);
    ui.setLogNote(entry?.note ?? "");
    ui.setLogEditing(true);
    ui.setLogOpen(true);
  };
  const saveLog = () => {
    const hours =
      ui.logType === "full"
        ? hoursPerDay
        : ui.logType === "half"
          ? hoursPerDay / 2
          : parseFloat(String(ui.logHours)) || 0;
    if (ui.logIsEvent) {
      worklogStore.setEventWorklog(
        selectedDate,
        ui.logEventType,
        hours,
        ui.logNote.trim() || undefined,
      );
    } else {
      worklogStore.setWorklog(
        selectedDate,
        ui.logClient,
        hours,
        ui.logNote.trim() || undefined,
      );
    }
    ui.setLogOpen(false);
    ui.setLogEditing(false);
  };
  const removeLog = () => {
    const targetId = ui.logIsEvent
      ? eventWorklogClientId(ui.logEventType)
      : ui.logClient;
    worklogStore.removeWorklog(selectedDate, targetId);
    ui.setLogOpen(false);
    ui.setLogEditing(false);
  };
  const triggerGitSync = () => worklogStore.sync();

  const saveSettings = (fields: {
    hoursPerDay?: number;
    weekStart?: number;
    autoSync?: { enabled?: boolean; delayMinutes?: number };
  }) => worklogStore.updateSettings(fields);

  // The "log time" form state, bundled from the individual UI-state fields so the
  // Today view can treat it as one value with one setter.
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
    ui.setLogOpen(next.open);
    ui.setLogEditing(next.editing);
    ui.setLogIsEvent(next.isEvent);
    ui.setLogEventType(next.eventType);
    ui.setLogClient(next.client);
    ui.setLogType(next.type);
    ui.setLogHours(next.hours);
    ui.setLogNote(next.note);
  };

  return {
    snap,
    toast,
    loading,
    today,
    tasks,
    worklog,
    clients,
    statuses,
    hoursPerDay,
    weekStart,
    autoSync,
    assetsBase,
    noClients: clients.length === 0,
    colorOf,
    clientName,
    statusMeta,
    typeLabel,
    logsFor,
    nonTerminal,
    firstStatusId,
    makeRow,
    openRowsFor,
    cycleStatus,
    markDone,
    toggleWorked,
    reopen,
    openDetail,
    openEdit,
    closeModal,
    deleteTask,
    openModal,
    openModalForDue,
    openTodoModal,
    openChildModal,
    openModalFromShortcut,
    saveTask,
    createClient,
    saveDescription,
    addNote,
    deleteNote,
    openClientEditor,
    saveClient,
    openLogForm,
    editLog,
    saveLog,
    removeLog,
    triggerGitSync,
    saveSettings,
    gitPending,
    logState,
    setLogState,
  };
}
