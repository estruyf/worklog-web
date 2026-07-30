// The shared read-model + action layer over a live snapshot. Everything here is
// used by more than one view (or by the shell/modals), so it's built once in the
// provider and exposed through DataContext instead of prop-drilled. Per-view
// derivations (groups, monthly rolls, search) live in each view's own data hook.

import { useCallback, useEffect, useMemo, useRef } from "react";
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
import {
  describeRecurrence,
  formatRecurrence,
  parseRecurrence,
} from "../../model/recurrence";
import { daysSinceEpoch } from "../../util/date";
import type { WorklogState } from "../state";
import { worklogStore, type ToastMessage } from "../../data/worklogStore";
import { closeTaskForm, navigateToTask, navigateToTaskForm, useRoute } from "../router";
import type { StatusMetaFn, LogState, WorklogRow } from "../model";
import {
  PALETTE,
  clientIdOf,
  defaultTaskClientId,
  dueOn,
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
  // `allClients` is every configured client; `clients` is the ones you still work
  // with. Views default to the latter — archived clients drop out of the pickers,
  // the day view and the log form — while name/colour lookups and the
  // retrospective surfaces (Archive, Search) keep resolving against all of them.
  const allClients = snap?.clients ?? [];
  const clients = useMemo(() => allClients.filter((c) => !c.archived), [allClients]);
  const archivedClients = useMemo(() => allClients.filter((c) => c.archived), [allClients]);
  const tasks = snap?.tasks ?? [];
  const worklog = snap?.worklog ?? [];
  const statuses = snap?.statuses ?? [];
  const today = snap?.today ?? "";
  const hoursPerDay = snap?.hoursPerDay ?? 0;
  const weekStart = snap?.weekStart ?? 0;
  const todosPerPage = snap?.todosPerPage ?? 5;
  const autoSync = snap?.autoSync ?? { enabled: false, delayMinutes: 5 };
  const { selectedDate } = ui;

  // Markdown image refs resolve against the store's in-memory asset bytes, so a
  // pasted image renders before it is ever committed. Stable — it reads the store
  // at call time, and the renderer resolves every ref on each render.
  const assetUrl = useCallback((ref: string) => worklogStore.assetUrl(ref), []);

  // O(1) lookups by id, rebuilt only when the snapshot's clients/statuses change.
  // Built from *all* clients so an archived one still resolves to its name and
  // colour wherever its history shows up, and so the palette index stays stable.
  const clientById = useMemo(() => {
    const m = new Map<string, { client: Client; index: number }>();
    allClients.forEach((c, i) => m.set(c.id, { client: c, index: i }));
    return m;
  }, [allClients]);
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

  // ---- tags ----
  // Every tag in use with how often, most-used first: the filter row in the
  // search overlay, and what makes a tag chip more than decoration.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      for (const tag of t.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [tasks]);

  const toggleTagFilter = useCallback((tag: string) => {
    ui.setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);
  const clearTagFilter = useCallback(() => ui.setTagFilter([]), []);
  /** Follow a tag chip from anywhere in the app into the search overlay, showing
   *  every task carrying it (open and archived). */
  const openTagSearch = useCallback((tag: string) => {
    ui.setTagFilter([tag]);
    ui.setDetailId(null);
    ui.setSearchOpen(true);
  }, []);

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

  // ---- task form ----
  // The form is a route (/app/new, /app/task/<id>/edit), so "open it" means seed
  // the fields and navigate. `seededForm` records which target the fields hold —
  // "new", a task id, or null when the form is closed — so the route effect below
  // knows the seeding already happened and only steps in for a form arrived at by
  // URL alone: a pasted link, a reload, or back/forward onto the route.
  const route = useRoute();
  const seededForm = useRef<string | null>(null);
  const resetRepeat = () => {
    ui.setMRepeat("");
    ui.setMRepeatFrom("schedule");
    ui.setMRepeatUntil("");
  };
  const seedNewForm = (clientId: string, parentId = "") => {
    ui.setEditingId(null);
    ui.setMTitle("");
    ui.setMClient(clientId);
    ui.setMParent(parentId);
    ui.setMLinks([""]);
    ui.setMDue("");
    resetRepeat();
    ui.setMTags([]);
    ui.setMDescription("");
    ui.setMDescMode("edit");
    ui.setAddingClient(false);
    seededForm.current = "new";
  };
  const seedEditForm = (t: Task) => {
    ui.setEditingId(t.id);
    ui.setMTitle(t.title);
    ui.setMClient(clientIdOf(t));
    ui.setMParent(t.parentId || "");
    const ls = linksOf(t);
    ui.setMLinks(ls.length ? ls : [""]);
    ui.setMDue(t.due || "");
    ui.setMRepeat(t.repeat ? formatRecurrence(t.repeat) : "");
    ui.setMRepeatFrom(t.repeat?.anchor ?? "schedule");
    ui.setMRepeatUntil(t.repeat?.until ?? "");
    ui.setMTags(t.tags ?? []);
    ui.setMDescription(t.description || "");
    ui.setMDescMode(t.description ? "preview" : "edit");
    ui.setAddingClient(false);
    seededForm.current = t.id;
  };
  /** Which client a brand-new task lands on: the one you're looking at, else the
   *  one the day's work points at. */
  const defaultFormClientId = () =>
    defaultTaskClientId({
      selectedClientId: ui.selectedClient,
      selectedDate,
      today,
      clients,
      worklog,
    });

  useEffect(() => {
    if (route.name !== "taskForm") {
      // Leaving the form clears what it was editing. Done here rather than in
      // closeTaskForm so the fields survive until the route actually changes —
      // history.back() only lands on the next popstate, and clearing early would
      // blank the still-mounted form for a frame.
      seededForm.current = null;
      ui.setEditingId(null);
      ui.setAddingClient(false);
      return;
    }
    // Wait for the snapshot: without clients loaded there is nothing sensible to
    // preselect, and marking the form seeded here would keep it empty for good.
    if (!snap || seededForm.current === (route.taskId ?? "new")) {
      return;
    }
    if (route.taskId) {
      const t = tasks.find((x) => x.id === route.taskId);
      if (t) {
        seedEditForm(t);
      }
      return;
    }
    seedNewForm(defaultFormClientId());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, snap, tasks]);

  const openEdit = useCallback((t: Task) => {
    seedEditForm(t);
    navigateToTaskForm(t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const deleteTask = useCallback(
    async (id: string, options?: { permanent?: boolean }) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) {
        return;
      }

      // A repeating task can't be "moved to archive" — closing it just rolls it
      // onto its next occurrence — so deleting one ends the series outright.
      // Completions already logged are separate archived blocks and survive.
      const isPermanent = options?.permanent || isDone(t) || !!t.repeat;
      const repeating = !!t.repeat && !isDone(t);
      const ok = isPermanent
        ? await ui.confirm.ask({
            title: repeating
              ? `Stop "${t.title}" from repeating and delete it?`
              : `Delete "${t.title}" forever?`,
            message: repeating
              ? "The series ends here. Completions already logged stay in the archive."
              : "This also removes subtasks and cannot be undone.",
            confirmLabel: repeating ? "Stop and delete" : "Delete forever",
            tone: "danger",
          })
        : await ui.confirm.ask({
            title: `Move "${t.title}" to archive?`,
            message: "You can restore it later from Archive.",
            confirmLabel: "Move to archive",
          });

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

      // Deleting the task the form is open on leaves the form with nothing to
      // save, so step off the route too.
      if (route.name === "taskForm" && route.taskId === id) {
        closeTaskForm();
      }
    },
    [tasks, ui.detailId, route, selectedDate],
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
      // On a day the rule lands on, the chip shows *that* occurrence — a
      // recurring task only stores its next due date, so showing it raw would
      // label a September occurrence with an August date.
      const displayDue = t.repeat && !isDone(t) && dueOn(t, selectedDate) ? selectedDate : t.due;
      // Overdue is judged on the occurrence being shown, not on the stored due
      // date: a daily task that also lands on the day you're looking at is due
      // then, not late, however far back its stored `due` sits.
      const overdue = !!displayDue && !isDone(t) && displayDue < today;
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
        due: displayDue,
        overdue,
        overdueDays: overdue ? daysSinceEpoch(today) - daysSinceEpoch(displayDue as string) : undefined,
        repeat: t.repeat && !isDone(t) ? describeRecurrence(t.repeat) : undefined,
        tags: t.tags ?? [],
        progress,
        onView: () => openDetail(t),
        onOpenTab: () => navigateToTask(t.id),
        onDone: () => markDone(t),
        onWorked: todo ? undefined : () => toggleWorked(t),
        onCycle: todo ? undefined : () => cycleStatus(t),
        onEdit: () => openEdit(t),
        onDelete: () => deleteTask(t.id),
        onTagClick: openTagSearch,
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
      openTagSearch,
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

  // ---- form actions (only fired from the rendered shell & pages) ----
  const openTaskForm = () => {
    seedNewForm(defaultFormClientId());
    navigateToTaskForm();
  };
  // Open the new-task form pre-seeded with a due date, e.g. from the calendar
  // when planning work for a future day.
  const openTaskFormForDue = (due: string) => {
    openTaskForm();
    ui.setMDue(due);
  };
  // Open the new-task form pre-assigned to the general to-do bucket, so the
  // To-dos view can add straight to its own list.
  const openTodoForm = () => {
    seedNewForm(GENERAL_TODO_CLIENT_ID);
    navigateToTaskForm();
  };
  const openSubtaskForm = (parent: Task) => {
    seedNewForm(clientIdOf(parent), parent.id);
    navigateToTaskForm();
  };
  const openTaskFormFromShortcut = () => {
    const detailTask = ui.detailId
      ? tasks.find((t) => t.id === ui.detailId)
      : undefined;
    if (detailTask && !isDone(detailTask)) {
      openSubtaskForm(detailTask);
      return;
    }
    openTaskForm();
  };
  const saveTask = () => {
    const title = ui.mTitle.trim();
    if (!title || !ui.mClient) {
      return;
    }
    const links = ui.mLinks.map((l) => l.trim()).filter(Boolean);
    const due = ui.mDue.trim() || undefined;
    // An unparseable expression saves as a plain one-off rather than blocking
    // the save; the picker already flags it while you type.
    const parsedRepeat = ui.mRepeat.trim()
      ? parseRecurrence(ui.mRepeat)
      : undefined;
    const repeat = parsedRepeat
      ? {
          ...parsedRepeat,
          anchor: ui.mRepeatFrom,
          until: ui.mRepeatUntil.trim() || undefined,
        }
      : undefined;
    // Already normalized and de-duplicated by the tag picker.
    const tags = ui.mTags;
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
        repeat: repeat ?? null,
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
        repeat,
      });
    }
    closeTaskForm();
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
    ui.setCDesc(c?.description ?? "");
    ui.setCLinks((c?.links ?? []).map((l) => ({ url: l.url, label: l.label ?? "" })));
    ui.setClientModalOpen(true);
  };
  const saveClient = () => {
    const name = ui.cName.trim();
    if (!name) {
      return;
    }
    // Blank rows the user added but never filled in are dropped rather than saved.
    const links = ui.cLinks
      .map((l) => ({ url: l.url.trim(), label: l.label.trim() }))
      .filter((l) => l.url);
    const description = ui.cDesc.trim();
    if (ui.editingClientId) {
      worklogStore.updateClient(ui.editingClientId, { name, color: ui.cColor, description, links });
    } else {
      ui.pendingClient.current = { name, target: "selected" };
      worklogStore.createClient(name, ui.cColor, { description, links });
    }
    ui.setClientModalOpen(false);
  };
  /** How much history a client carries. Drives the copy in the client editor and
   *  gates deletion — the service refuses one that still has tasks or hours. */
  const clientUsage = useCallback(
    (id: string) => ({
      tasks: tasks.filter((t) => t.clientIds.includes(id)).length,
      worklog: worklog.filter((w) => w.clientId === id).length,
    }),
    [tasks, worklog],
  );
  const setClientArchived = useCallback((c: Client, archived: boolean) => {
    worklogStore.setClientArchived(c.id, archived);
    ui.setClientModalOpen(false);
  }, []);
  const deleteClient = useCallback(
    async (c: Client) => {
      const usage = clientUsage(c.id);
      if (usage.tasks > 0 || usage.worklog > 0) {
        // Archiving is the non-destructive answer; the service refuses this too.
        await ui.confirm.notify({
          title: `"${c.name}" still has history`,
          message:
            `It carries ${usage.tasks} task${usage.tasks === 1 ? "" : "s"} and ` +
            `${usage.worklog} time entr${usage.worklog === 1 ? "y" : "ies"}, so it can't be deleted. ` +
            "Archive it instead to hide it while keeping every task and logged hour.",
        });
        return;
      }
      const ok = await ui.confirm.ask({
        title: `Delete "${c.name}"?`,
        message:
          "It has no tasks or logged time, so nothing is lost. This cannot be undone.",
        confirmLabel: "Delete client",
        tone: "danger",
      });
      if (!ok) {
        return;
      }
      worklogStore.deleteClient(c.id);
      ui.setClientModalOpen(false);
    },
    [clientUsage],
  );
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
    // Guards the case where every client is archived: without a client id the
    // ledger line would serialise hollow.
    if (!ui.logIsEvent && !ui.logClient) {
      return;
    }
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
    todosPerPage?: number;
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
    allClients,
    archivedClients,
    statuses,
    hoursPerDay,
    weekStart,
    todosPerPage,
    autoSync,
    assetUrl,
    // Archived clients still count as clients — otherwise archiving the last one
    // would drop you on the "add your first client" screen with no way back.
    noClients: allClients.length === 0,
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
    deleteTask,
    openTaskForm,
    openTaskFormForDue,
    openTodoForm,
    openSubtaskForm,
    openTaskFormFromShortcut,
    saveTask,
    createClient,
    saveDescription,
    addNote,
    deleteNote,
    openClientEditor,
    saveClient,
    clientUsage,
    setClientArchived,
    deleteClient,
    allTags,
    toggleTagFilter,
    clearTagFilter,
    openTagSearch,
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
