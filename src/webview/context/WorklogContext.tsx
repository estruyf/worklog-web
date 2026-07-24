// App-wide wiring for the Worklog webview. WorklogProvider owns the live snapshot,
// the UI state and the derived read-model + actions, and exposes them through two
// contexts so views/modals pull exactly what they need instead of receiving a long
// prop list:
//   - useUi()   -> transient UI state (current view, selections, modal/form fields)
//   - useData() -> snapshot-derived read-model, helpers and host mutations
// Per-view data (task groups, monthly rolls, search hits) is derived in each view's
// own hook on top of these, so only the mounted view recomputes it.

import React, { createContext, useContext } from 'react';
import { useSnapshot, useWorklogUiState, useWorklogModel } from '../hooks';
import { clientIdOf, defaultTaskClientId, isDone } from '../utils';
import { Snapshot } from '../protocol';

type UiState = ReturnType<typeof useWorklogUiState>;
type WorklogData = ReturnType<typeof useWorklogModel>;

const UiContext = createContext<UiState | undefined>(undefined);
const DataContext = createContext<WorklogData | undefined>(undefined);

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
  const snapRef = React.useRef<Snapshot | null>(null);
  const selectedDateRef = React.useRef('');
  const selectedClientRef = React.useRef('');
  const detailIdRef = React.useRef<string | null>(null);

  // Live snapshot + host-message wiring. Navigation and quick-add messages seed
  // local view/modal state.
  const { snap, error, gitPending } = useSnapshot({
    onNavigate: (tab, clientId) => {
      // Search is an overlay, not a routable view — the host still targets it by tab.
      if (tab === 'search') {
        ui.setSearchOpen(true);
      } else {
        ui.setView(tab);
      }
      if (clientId) {
        ui.setSelectedClient(clientId);
      }
    },
    onOpenAddTask: (clientId) => {
      const currentSnap = snapRef.current;
      const selectedDate = selectedDateRef.current;
      const selectedClient = selectedClientRef.current;
      const detailId = detailIdRef.current;
      const detailTask = detailId
        ? currentSnap?.tasks.find((t) => t.id === detailId)
        : undefined;
      const asChild = !!detailTask && !isDone(detailTask);
      ui.setEditingId(null);
      ui.setMTitle('');
      ui.setMParent(asChild ? detailTask.id : '');
      ui.setMLinks(['']);
      ui.setMDue('');
      ui.setMTags('');
      ui.setMDescription('');
      ui.setMDescMode('edit');
      ui.setAddingClient(false);
      ui.setMClient(
        asChild
          ? clientIdOf(detailTask)
          : defaultTaskClientId({
            preferredClientId: clientId,
            selectedClientId: selectedClient,
            selectedDate,
            today: currentSnap?.today,
            clients: currentSnap?.clients ?? [],
            worklog: currentSnap?.worklog ?? [],
          }),
      );
      ui.setModalOpen(true);
    },
  });

  snapRef.current = snap;
  selectedDateRef.current = ui.selectedDate;
  selectedClientRef.current = ui.selectedClient;
  detailIdRef.current = ui.detailId;

  // Seed defaults / reconcile selections whenever the snapshot changes.
  React.useEffect(() => {
    if (!snap) {
      return;
    }
    ui.setSelectedDate((d) => d || snap.today);
    ui.setMonth((mo) => mo || snap.today.slice(0, 7));
    ui.setSelectedClient((c) => (c && snap.clients.some((x) => x.id === c) ? c : snap.clients[0]?.id || ''));
    const pending = ui.pendingClient.current;
    if (pending) {
      const match = snap.clients.find((c) => c.name === pending.name);
      if (match) {
        if (pending.target === 'modal') {
          ui.setMClient(match.id);
        } else {
          ui.setSelectedClient(match.id);
        }
        ui.pendingClient.current = undefined;
        ui.setAddingClient(false);
        ui.setNewClientName('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

  React.useEffect(() => {
    if (snap && ui.selectedDate === snap.today) {
      ui.setEditDayOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.selectedDate, snap]);

  // Close the detail view if the task it points at was deleted out from under us.
  React.useEffect(() => {
    if (snap && ui.detailId && !snap.tasks.some((t) => t.id === ui.detailId)) {
      ui.setDetailId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, ui.detailId]);

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

  const data = useWorklogModel(snap, ui, error, gitPending);

  return (
    <UiContext.Provider value={ui}>
      <DataContext.Provider value={data}>{children}</DataContext.Provider>
    </UiContext.Provider>
  );
}
