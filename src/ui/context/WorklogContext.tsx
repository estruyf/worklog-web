// App-wide wiring for the Worklog UI. WorklogProvider owns the live app state,
// the UI state and the derived read-model + actions, and exposes them through two
// contexts so views/modals pull exactly what they need instead of receiving a long
// prop list:
//   - useUi()   -> transient UI state (current view, selections, modal/form fields)
//   - useData() -> state-derived read-model, helpers and store mutations
// Per-view data (task groups, monthly rolls, search hits) is derived in each view's
// own hook on top of these, so only the mounted view recomputes it.

import React, { createContext, useContext } from 'react';
import { useAppBadge, useWorklogState, useWorklogUiState, useWorklogModel } from '../hooks';
import { useRoute } from '../router';

type UiState = ReturnType<typeof useWorklogUiState>;
type WorklogData = ReturnType<typeof useWorklogModel>;

const UiContext = createContext<UiState | undefined>(undefined);
const DataContext = createContext<WorklogData | undefined>(undefined);

/** The one thing the shell needs from whatever task form is on screen: whether it
 *  can be saved, and how. The form's fields stay the form's own — this is the
 *  narrow seam that lets the mobile top bar offer Save from outside it. */
export interface TaskFormBar {
  canSave: boolean;
  submit: () => void;
}

const TaskFormBarContext = createContext<TaskFormBar | null>(null);
// Split from the value above so publishing never re-renders the publisher: the
// setter is stable, the value changes.
const PublishTaskFormBarContext = createContext<(bar: TaskFormBar | null) => void>(() => {});

/** The open form's save affordance, or null when no form is mounted. */
export function useTaskFormBar(): TaskFormBar | null {
  return useContext(TaskFormBarContext);
}

/** For the form itself: publish on mount, clear on unmount. */
export function usePublishTaskFormBar(): (bar: TaskFormBar | null) => void {
  return useContext(PublishTaskFormBarContext);
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) {
    throw new Error('useUi must be used within WorklogProvider');
  }
  return ctx;
}

export function useData(): WorklogData {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used within WorklogProvider');
  }
  return ctx;
}

export function WorklogProvider({ children }: { children: React.ReactNode }) {
  const ui = useWorklogUiState();

  // Live app state read straight from the store.
  const { snap, toast, gitPending, pendingCount, loading, offline } = useWorklogState();

  // The URL owns the active dashboard view; mirror it into UI state so the sidebar
  // highlight and view rendering follow navigation and browser back/forward.
  const route = useRoute();
  const routeView = route.name === 'view' ? route.view : undefined;
  React.useEffect(() => {
    if (routeView) {
      ui.setView(routeView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeView]);

  // Seed defaults / reconcile selections whenever the state changes.
  React.useEffect(() => {
    if (!snap) {
      return;
    }
    ui.setSelectedDate((d) => d || snap.today);
    ui.setMonth((mo) => mo || snap.today.slice(0, 7));
    // Keep whatever is selected if it still exists (archived included — the
    // Clients view can open those); otherwise fall back to an active client.
    ui.setSelectedClient((c) =>
      c && snap.clients.some((x) => x.id === c)
        ? c
        : (snap.clients.find((x) => !x.archived) ?? snap.clients[0])?.id || '',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

  React.useEffect(() => {
    if (snap && ui.selectedDate === snap.today) {
      ui.setEditDayOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.selectedDate, snap]);

  // No effect closes a task whose id stops resolving. The task is a route now, so
  // that case is a link to something deleted — worth saying (TaskDetailPanel says
  // it) rather than redirecting. Deleting the task you are looking at steps off the
  // route from the action itself, in useTaskActions.

  // Load the markdown draft whenever a different task is opened. Intentionally keyed
  // on detailId only: a snapshot refresh after saving must not clobber an in-progress edit.
  React.useEffect(() => {
    if (!ui.detailId) {
      return;
    }
    const t = snap?.tasks.find((x) => x.id === ui.detailId);
    ui.setDescDraft(t?.description ?? '');
    ui.setDescMode('preview');
    ui.setNoteDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.detailId]);

  // Same shape and same reason as the description draft above, one day at a
  // time: keyed on the date alone so a snapshot refresh — including the one the
  // save itself triggers — can't overwrite what is being typed.
  React.useEffect(() => {
    if (!ui.selectedDate) {
      return;
    }
    ui.setDayNoteDraft(snap?.dayNotes.find((n) => n.date === ui.selectedDate)?.body ?? '');
    ui.setDayNoteMode('preview');
    // The stamp confirms a save on *this* day; carrying it across would have it
    // vouching for a note the new day doesn't have.
    ui.setDayNoteSavedAt('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.selectedDate]);

  const data = useWorklogModel(snap, ui, toast, gitPending, loading, offline, pendingCount);

  // The installed app's icon badge. Here rather than in the dashboard because it
  // outlives the route: the single-task page is just as much "the app is open",
  // and the provider is what unmounts when the repo does.
  useAppBadge(data.tasks, data.today);

  const [taskFormBar, setTaskFormBar] = React.useState<TaskFormBar | null>(null);

  return (
    <UiContext.Provider value={ui}>
      <DataContext.Provider value={data}>
        <PublishTaskFormBarContext.Provider value={setTaskFormBar}>
          <TaskFormBarContext.Provider value={taskFormBar}>{children}</TaskFormBarContext.Provider>
        </PublishTaskFormBarContext.Provider>
      </DataContext.Provider>
    </UiContext.Provider>
  );
}
