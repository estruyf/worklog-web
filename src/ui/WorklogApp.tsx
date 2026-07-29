// The Worklog dashboard: the always-on chrome (nav, modals, toast) plus whichever
// view is active. All state, snapshot wiring and mutations live in ./context
// (WorklogProvider — mounted by WebApp, above the routes — plus useUi/useData);
// each view derives its own data from those, so nothing is prop-drilled here.

import React from 'react';
import { useData, useUi } from './context';
import { useSearchData } from './hooks';
import { ClientFormModal, Toast, SearchOverlay, Sidebar, TaskDetailPanel, TaskFormPage } from './components';
import type { SidebarRepoProps } from './components/Sidebar';
import { EmptyClientsView } from './views/EmptyClientsView';
import { ROUTES } from './views/routes';
import { useRoute } from './router';

/** Lightweight top-of-page progress bar shown while the store is loading. */
function Loader({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className={overlay ? 'fixed inset-0 z-50 bg-black/5' : 'fixed inset-x-0 top-0 z-50'} aria-busy="true" aria-label="Loading">
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-[worklog-slide_1.1s_ease-in-out_infinite] bg-info" />
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

export function WorklogApp({ repoProps }: { repoProps?: SidebarRepoProps } = {}) {
  const { snap, toast, loading, noClients, openTaskFormFromShortcut, openLogForm } = useData();
  const { view, searchOpen, detailId, clientModalOpen, setSearchOpen, setDetailId, setClientModalOpen, searchSel, setSearchSel } = useUi();
  const searchData = useSearchData();
  // The task form is a route, but it lives in the dashboard's main column rather
  // than a page of its own: leaving the nav behind made it read as a different app.
  const formOpen = useRoute().name === 'taskForm';

  // Latest state/actions for the global key handler, so it can stay subscribed
  // once instead of re-binding on every keystroke.
  const stateRef = React.useRef({ searchOpen, detailId, clientModalOpen, formOpen, searchSel, searchData, openTaskFormFromShortcut, openLogForm });
  stateRef.current = { searchOpen, detailId, clientModalOpen, formOpen, searchSel, searchData, openTaskFormFromShortcut, openLogForm };

  // Global shortcuts. ⌘F/⌘S -> open the Search overlay (⌘S also suppresses the
  // browser's save dialog); ⇧N (or ⌘N in the PWA) -> New task; ⌘L on the Day view
  // -> open the in-app log form; Esc
  // closes the top-most dialog; while the Search overlay is open, ↑/↓ move the
  // hit cursor and ↵ opens the selected hit and closes the overlay. The search
  // input auto-focuses on mount; re-focus it explicitly for when the overlay is
  // already open.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      // The task form fills this column and binds its own Esc / ⌘S / ⌘↵; nothing
      // here should fire underneath it.
      if (s.formOpen) {
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const idle = !s.searchOpen && !s.detailId && !s.clientModalOpen && !isEditableTarget(e.target);

      if (meta && (key === 's' || key === 'f')) {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => document.getElementById('worklog-search-input')?.focus());
        return;
      }
      // ⌘/Ctrl+N is reserved by the browser ("new window") and never reaches the
      // page, so it only fires in the installed PWA. ⇧N is the shortcut that
      // actually works in a tab, hence the two accepted forms.
      if ((meta && key === 'n') || (key === 'n' && e.shiftKey && !e.altKey && idle)) {
        e.preventDefault();
        s.openTaskFormFromShortcut();
        return;
      }
      if (meta && key === 'l' && view === 'day' && idle) {
        e.preventDefault();
        s.openLogForm();
        return;
      }
      if (e.key === 'Escape') {
        if (s.clientModalOpen) {
          setClientModalOpen(false);
        } else if (s.detailId) {
          setDetailId(null);
        } else if (s.searchOpen) {
          setSearchOpen(false);
        }
        return;
      }

      // Keyboard nav within the Search overlay, but not while a dialog is layered over it.
      if (s.searchOpen && !s.detailId && !s.clientModalOpen) {
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

  if (!snap) {
    return <div className="min-h-screen bg-white" />;
  }

  const ActiveView = ROUTES[view];

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-white text-neutral-825 antialiased" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <style>{`::selection{background:#FBEFC0}`}</style>

      {loading && <Loader overlay={false} />}

      <Sidebar {...repoProps} />

      <main className="flex flex-1 min-w-0 flex-col">
        {noClients ? <EmptyClientsView /> : formOpen ? <TaskFormPage /> : <ActiveView />}
      </main>

      {searchOpen && <SearchOverlay />}
      {detailId && <TaskDetailPanel />}
      {clientModalOpen && <ClientFormModal />}

      <Toast toast={toast} />
    </div>
  );
}
