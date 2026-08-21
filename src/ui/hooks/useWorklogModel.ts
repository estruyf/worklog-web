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
import { repoKeyOf } from "../../data/pendingStore";
import { worklogStore, type ToastMessage } from "../../data/worklogStore";
import type { AiAgent, AutoSyncConfig, AutoSyncEvent, CodeTheme, FeatureConfig, TaskSortPref } from "../../model/types";
import { DEFAULT_CODE_THEME } from "../../model/codeTheme";
import { DEFAULT_TASK_SORT } from "../../model/taskSort";
import type { WorklogState } from "../state";
import { useCollapsedTasks } from "./useCollapsedTasks";
import { useClientModel } from "./model/useClientModel";
import { useDayNoteModel } from "./model/useDayNoteModel";
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

/** Same reason as `NO_AUTO_SYNC`, and the same answer a repo with no config.json
 *  gives: both blocks are on until a setting says otherwise. */
const ALL_FEATURES: FeatureConfig = { attachments: true, prompts: true };

/** Same reason as `NO_AUTO_SYNC`: `useTaskListFilter` seeds its state from this
 *  and resets to it, so a fresh object per render would re-seed every list. */
const NO_TASK_SORT: TaskSortPref = { ...DEFAULT_TASK_SORT };

export function useWorklogModel(
  snap: WorklogState | null,
  ui: WorklogUiState,
  toast: ToastMessage | null,
  gitPending = false,
  loading = false,
  offline = false,
  pendingCount = 0,
  syncError: string | null = null,
  lastSyncedAt: number | null = null,
  dismissToast: () => void = () => undefined,
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
  const dayNotes = useMemo(() => snap?.dayNotes ?? [], [snap]);
  const statuses = useMemo(() => snap?.statuses ?? [], [snap]);
  const aiAgents = useMemo(() => snap?.aiAgents ?? [], [snap]);
  const today = snap?.today ?? "";
  const hoursPerDay = snap?.hoursPerDay ?? 0;
  const weekStart = snap?.weekStart ?? 0;
  const todosPerPage = snap?.todosPerPage ?? 5;
  const defaultTaskSort = snap?.defaultTaskSort ?? NO_TASK_SORT;
  const codeTheme = snap?.codeTheme ?? DEFAULT_CODE_THEME;
  const autoSync = snap?.autoSync ?? NO_AUTO_SYNC;
  const features = snap?.features ?? ALL_FEATURES;
  const { selectedDate, selectedClient } = ui;

  // Markdown image refs resolve against the store's in-memory asset bytes, so a
  // pasted image renders before it is ever committed. Stable — it reads the store
  // at call time, and the renderer resolves every ref on each render.
  const assetUrl = useCallback((ref: string) => worklogStore.assetUrl(ref), []);

  // Which repo the device-local list preferences belong to. Recomputed off the
  // snapshot because that is what changes when a repo finishes opening — the
  // store's repo is set before the first snapshot exists, so `snap` is the signal.
  // Same key the pending-edit snapshots use: one notion of "which repo is this".
  const repoKey = useMemo(() => {
    const open = snap ? worklogStore.currentRepo() : undefined;
    return open ? repoKeyOf(open.owner, open.repo, open.branch) : "";
  }, [snap]);
  const taskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const { collapsed, toggleCollapsed } = useCollapsedTasks(repoKey, taskIds);

  const clientModel = useClientModel(allClients, clients, tasks, worklog, ui);
  const statusModel = useStatusModel(statuses, tasks, ui);
  const tagModel = useTagModel(tasks, ui);
  const taskActions = useTaskActions(tasks, selectedDate, ui);
  const rows = useTaskRows({
    tasks,
    today,
    selectedDate,
    collapsed,
    toggleCollapsed,
    statusMeta: statusModel.statusMeta,
    statusChoices: statusModel.statusChoices,
    setTaskStatus: statusModel.setTaskStatus,
    openTagSearch: tagModel.openTagSearch,
    openDetail: taskActions.openDetail,
    markDone: taskActions.markDone,
    toggleWorked: taskActions.toggleWorked,
    openEdit: taskActions.openEdit,
    deleteTask: taskActions.deleteTask,
  });
  const taskForm = useTaskFormActions({ tasks, clients, worklog, today, selectedDate, selectedClient }, ui);
  const logModel = useLogModel(worklog, clients, hoursPerDay, selectedDate, ui);
  const dayNoteModel = useDayNoteModel(dayNotes, selectedDate, ui);

  const triggerGitSync = () => worklogStore.sync();

  const saveSettings = (fields: {
    hoursPerDay?: number;
    weekStart?: number;
    todosPerPage?: number;
    defaultTaskSort?: TaskSortPref;
    codeTheme?: CodeTheme;
    autoSync?: { enabled?: boolean; delayMinutes?: number; events?: AutoSyncEvent[] };
    features?: { attachments?: boolean; prompts?: boolean };
    aiAgents?: AiAgent[];
  }) => worklogStore.updateSettings(fields);

  return {
    snap,
    toast,
    dismissToast,
    loading,
    today,
    tasks,
    worklog,
    dayNotes,
    clients,
    allClients,
    archivedClients,
    statuses,
    hoursPerDay,
    weekStart,
    todosPerPage,
    defaultTaskSort,
    codeTheme,
    autoSync,
    features,
    aiAgents,
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
    ...dayNoteModel,
    triggerGitSync,
    saveSettings,
    gitPending,
    pendingCount,
    offline,
    syncError,
    lastSyncedAt,
  };
}
