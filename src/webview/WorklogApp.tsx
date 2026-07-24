// The Worklog dashboard. WorklogApp just mounts the provider; Shell composes the
// always-on chrome (nav, modals, toast) and routes to the active view. All state,
// snapshot wiring and mutations live in ./context (WorklogProvider + useUi/useData);
// each view derives its own data from those, so nothing is prop-drilled here.

import React from 'react';
import { useData, useUi, WorklogProvider } from './context';
import { useSearchData } from './hooks';
import { ClientFormModal, ErrorToast, SearchOverlay, Sidebar, TaskDetailPanel, TaskFormModal } from './components';
import type { SidebarRepoProps } from './components/Sidebar';
import { EmptyClientsView } from './views/EmptyClientsView';
import { ROUTES } from './views/routes';
import { onHostMessage, post } from './vscodeApi';
import type { HostMessage } from './protocol';

/** Lightweight replacement for vscrui's Loader — a top-of-page progress bar. */
function Loader({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className={overlay ? 'fixed inset-0 z-50 bg-black/5' : 'fixed inset-x-0 top-0 z-50'} aria-busy="true" aria-label="Loading">
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-[worklog-slide_1.1s_ease-in-out_infinite] bg-[#2D6CDF]" />
      </div>
      <style>{`@keyframes worklog-slide{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function Shell({ repoProps }: { repoProps?: SidebarRepoProps }) {
  const { snap, error, noClients, openModalFromShortcut, closeModal, openLogForm } = useData();
  const { view, searchOpen, modalOpen, detailId, clientModalOpen, setSearchOpen, setDetailId, setClientModalOpen, searchSel, setSearchSel } = useUi();
  const searchData = useSearchData();
  const [loading, setLoading] = React.useState(true);

  // Latest state/actions for the global key handler, so it can stay subscribed
  // once instead of re-binding on every keystroke.
  const stateRef = React.useRef({ searchOpen, modalOpen, detailId, clientModalOpen, searchSel, searchData, openModalFromShortcut, closeModal, openLogForm });
  stateRef.current = { searchOpen, modalOpen, detailId, clientModalOpen, searchSel, searchData, openModalFromShortcut, closeModal, openLogForm };

  // Global shortcuts. ⌘R -> reload the whole webview; ⌘F/⌘S -> open the Search
  // overlay (also stops VS Code's save); ⌘N -> New task; ⌘L on the Day view ->
  // open the in-app log form; Esc
  // closes the top-most dialog; while the Search overlay is open, ↑/↓ move the
  // hit cursor and ↵ opens the selected hit and closes the overlay. The search
  // input auto-focuses on mount; re-focus it explicitly for when the overlay is
  // already open.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && (key === 's' || key === 'f')) {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => document.getElementById('worklog-search-input')?.focus());
        return;
      }
      if (meta && key === 'n') {
        e.preventDefault();
        s.openModalFromShortcut();
        return;
      }
      if (
        meta &&
        key === 'l' &&
        view === 'day' &&
        !s.searchOpen &&
        !s.modalOpen &&
        !s.detailId &&
        !s.clientModalOpen &&
        !isEditableTarget(e.target)
      ) {
        e.preventDefault();
        s.openLogForm();
        return;
      }
      if (e.key === 'Escape') {
        if (s.modalOpen) {
          s.closeModal();
        } else if (s.clientModalOpen) {
          setClientModalOpen(false);
        } else if (s.detailId) {
          setDetailId(null);
        } else if (s.searchOpen) {
          setSearchOpen(false);
        }
        return;
      }

      // Keyboard nav within the Search overlay, but not while a dialog is layered over it.
      if (s.searchOpen && !s.modalOpen && !s.detailId && !s.clientModalOpen) {
        const count = s.searchData.count;
        if (count === 0) {
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSearchSel((v) => Math.min(v + 1, count - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSearchSel((v) => Math.max(v - 1, 0));
        } else if (e.key === 'Enter') {
          const hit = s.searchData.flat[stateRef.current.searchSel];
          if (hit) {
            e.preventDefault();
            hit.onEdit();
            setSearchOpen(false);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSearchOpen, setDetailId, setClientModalOpen, setSearchSel]);

  React.useEffect(() => {
    const messageHandler = onHostMessage((m: HostMessage) => {
      if (m.type !== 'loading') {
        return;
      }
      setLoading(m.loading);
    });

    return () => {
      messageHandler();
    };
  }, []);

  if (!snap) {
    return <div className="min-h-screen bg-white" />;
  }

  const ActiveView = ROUTES[view];

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-white text-[#1F2328] antialiased" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <style>{`::selection{background:#FBEFC0}`}</style>

      {loading && <Loader overlay={false} />}

      <Sidebar {...repoProps} />

      <main className="flex flex-1 min-w-0 flex-col">
        {noClients ? <EmptyClientsView /> : <ActiveView />}
      </main>

      {searchOpen && <SearchOverlay />}
      {modalOpen && <TaskFormModal />}
      {detailId && <TaskDetailPanel />}
      {clientModalOpen && <ClientFormModal />}

      <ErrorToast message={error} />
    </div>
  );
}

export function WorklogApp({ repoProps }: { repoProps?: SidebarRepoProps } = {}) {
  return (
    <WorklogProvider>
      <Shell repoProps={repoProps} />
    </WorklogProvider>
  );
}
