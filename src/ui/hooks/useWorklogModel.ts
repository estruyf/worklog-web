// The shared read-model + action layer over a live snapshot. Everything here is
// used by more than one view (or by the shell/modals), so it's built once in the
// provider and exposed through DataContext instead of prop-drilled. Per-view
// derivations (groups, monthly rolls, search) live in each view's own data hook.
//
// This file is the composition: it unpacks the snapshot into the stable arrays
// everything downstream depends on, calls one hook per concern (clients,
// statuses, tags, task actions, task rows, the task form, the time log) and
// publishes their results as one object. Each of those hooks lives in ./model and
// takes exactly the slices it reads.

import { useCallback, useMemo } from "react";
import { worklogStore, type ToastMessage } from "../../data/worklogStore";
import type { AutoSyncConfig, AutoSyncEvent } from "../../model/types";
import type { WorklogState } from "../state";
import { useClientModel } from "./model/useClientModel";
import { useLogModel } from "./model/useLogModel";
import { useStatusModel } from "./model/useStatusModel";
import { useTagModel } from "./model/useTagModel";
import { useTaskActions } from "./model/useTaskActions";
import { useTaskFormActions } from "./model/useTaskFormActions";
import { useTaskRows } from "./model/useTaskRows";
import type { WorklogUiState } from "./useWorklogUiState";

/** What `autoSync` reads as before a repo is loaded. A module constant so the
 *  reference is stable across renders, like the memoized collections below. */
const NO_AUTO_SYNC: AutoSyncConfig = { enabled: false, delayMinutes: 5, events: [] };

export function useWorklogModel(
  snap: WorklogState | null,
  ui: WorklogUiState,
  toast: ToastMessage | null,
  gitPending = false,
  loading = false,
) {
  // The snapshot's collections, memoized on the snapshot itself: `?? []` would
  // hand out a fresh array on every render and re-run every memo built on it.
  //
  // `allClients` is every configured client; `clients` is the ones you still work
  // with. Views default to the latter — archived clients drop out of the pickers,
  // the day view and the log form — while name/colour lookups and the
  // retrospective surfaces (Archive, Search) keep resolving against all of them.
  const allClients = useMemo(() => snap?.clients ?? [], [snap]);
  const clients = useMemo(() => allClients.filter((c) => !c.archived), [allClients]);
  const archivedClients = useMemo(() => allClients.filter((c) => c.archived), [allClients]);
  const tasks = useMemo(() => snap?.tasks ?? [], [snap]);
  const worklog = useMemo(() => snap?.worklog ?? [], [snap]);
  const statuses = useMemo(() => snap?.statuses ?? [], [snap]);
  const today = snap?.today ?? "";
  const hoursPerDay = snap?.hoursPerDay ?? 0;
  const weekStart = snap?.weekStart ?? 0;
  const todosPerPage = snap?.todosPerPage ?? 5;
  const autoSync = snap?.autoSync ?? NO_AUTO_SYNC;
  const { selectedDate, selectedClient } = ui;

  // Markdown image refs resolve against the store's in-memory asset bytes, so a
  // pasted image renders before it is ever committed. Stable — it reads the store
  // at call time, and the renderer resolves every ref on each render.
  const assetUrl = useCallback((ref: string) => worklogStore.assetUrl(ref), []);

  const clientModel = useClientModel(allClients, clients, tasks, worklog, ui);
  const statusModel = useStatusModel(statuses);
  const tagModel = useTagModel(tasks, ui);
  const taskActions = useTaskActions(tasks, selectedDate, ui);
  const rows = useTaskRows({
    tasks,
    today,
    selectedDate,
    statusMeta: statusModel.statusMeta,
    cycleStatus: statusModel.cycleStatus,
    openTagSearch: tagModel.openTagSearch,
    openDetail: taskActions.openDetail,
    markDone: taskActions.markDone,
    toggleWorked: taskActions.toggleWorked,
    openEdit: taskActions.openEdit,
    deleteTask: taskActions.deleteTask,
  });
  const taskForm = useTaskFormActions({ tasks, clients, worklog, today, selectedDate, selectedClient }, ui);
  const logModel = useLogModel(worklog, clients, hoursPerDay, selectedDate, ui);

  const triggerGitSync = () => worklogStore.sync();

  const saveSettings = (fields: {
    hoursPerDay?: number;
    weekStart?: number;
    todosPerPage?: number;
    autoSync?: { enabled?: boolean; delayMinutes?: number; events?: AutoSyncEvent[] };
  }) => worklogStore.updateSettings(fields);

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
    ...clientModel,
    ...statusModel,
    ...tagModel,
    ...taskActions,
    ...rows,
    ...taskForm,
    ...logModel,
    triggerGitSync,
    saveSettings,
    gitPending,
  };
}
