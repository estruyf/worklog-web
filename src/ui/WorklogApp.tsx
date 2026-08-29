// The Worklog dashboard: the always-on chrome (nav, modals, toast) plus whichever
// view is active. All state, snapshot wiring and mutations live in ./context
// (WorklogProvider — mounted by WebApp, above the routes — plus useUi/useData);
// each view derives its own data from those, so nothing is prop-drilled here.

import React from 'react';
import { useData, useUi } from './context';
import { useSearchData } from './hooks';
import { ClientFormModal, ConfirmDialog, Toast, SearchOverlay, Sidebar, SyncStatusBar, TaskDetailPanel, TaskFormPage } from './components';
import type { SidebarRepoProps } from './components/Sidebar';
import { EmptyClientsView } from './views/EmptyClientsView';
import { ROUTES, warmLazyRoutes } from './views/routes';
import { navigateToView, useRoute } from './router';

/** Lightweight top-of-page progress bar shown while the store is loading. */
function Loader({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className={overlay ? 'fixed inset-0 z-50 bg-black/5' : 'fixed inset-x-0 top-0 z-50'} aria-busy="true" aria-label="Loading">
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        {/* `worklog-slide` is defined in ui/styles.css — see the note there. */}
        <div className="h-full w-1/3 animate-[worklog-slide_1.1s_ease-in-out_infinite] bg-info" />
      </div>
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
  const { snap, toast, dismissToast, loading, noClients, today, features, openTaskFormInContext, openLogForm } = useData();
  const { view, searchOpen, detailId, clientModalOpen, setSearchOpen, setDetailId, searchSel, setSearchSel, setSelectedDate } = useUi();
  const searchData = useSearchData();
  // The task form and the open task are routes, but both live in the dashboard's
  // main column rather than pages of their own: leaving the nav behind made them
  // read as a different app. It also means a shared /app/task/<id> link opens the
  // app someone can actually move around in, with search and the dialogs mounted.
  const routeName = useRoute().name;
  const formOpen = routeName === 'taskForm';
  const taskOpen = routeName === 'task';

  // Latest state/actions for the global key handler, so it can stay subscribed
  // once instead of re-binding on every keystroke. Everything the handler reads
  // goes through here — a value read straight from the closure would be frozen at
  // mount, since the effect below deliberately never re-subscribes.
  // Written after commit, not during render: a render that React discards must not
  // leave the handler pointing at state that was never shown.
  const stateRef = React.useRef({ view, searchOpen, detailId, clientModalOpen, formOpen, searchSel, searchData, today, openTaskFormInContext, openLogForm });
  React.useEffect(() => {
    stateRef.current = { view, searchOpen, detailId, clientModalOpen, formOpen, searchSel, searchData, today, openTaskFormInContext, openLogForm };
  });

  // Global shortcuts. ⌘F/⌘S -> open the Search overlay (⌘S also suppresses the
  // browser's save dialog); ⇧N (or ⌘N in the PWA) -> New task; ⇧D/⌘D -> the Day
  // view; ⌘L on the Day view -> open the in-app log form; Esc
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
        s.openTaskFormInContext();
        return;
      }
      // ⇧D / ⌘D -> the Day view, snapped back to today the same way the sidebar's
      // Day tab does: a date left over from browsing the calendar isn't what the
      // shortcut means. ⌘D is the browser's "bookmark this page" — preventDefault
      // keeps that dialog from opening over the app.
      if ((meta && key === 'd') || (key === 'd' && e.shiftKey && !e.altKey && idle)) {
        e.preventDefault();
        if (s.today) {
          setSelectedDate(s.today);
        }
        navigateToView('day');
        return;
      }
      if (meta && key === 'l' && s.view === 'day' && idle) {
        e.preventDefault();
        s.openLogForm();
        return;
      }
      // Only the open task is handled here — Escape leaves its route the same way
      // Back does. The dialogs (search, client form, confirm) are `Modal`s, which
      // own Escape themselves and stop it before it reaches this listener, so a
      // dialog layered over the task closes the dialog, not the task underneath.
      if (e.key === 'Escape') {
        if (s.detailId) {
          setDetailId(null);
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
  }, [setSearchOpen, setDetailId, setSearchSel, setSelectedDate]);

  // After the first paint, not during it: the point of splitting these out is that
  // they are off the critical path. See warmLazyRoutes for why they're fetched at all.
  React.useEffect(warmLazyRoutes, []);

  if (!snap) {
    return <div className="min-h-screen bg-white" />;
  }

  // A hidden tab is not a hidden view: /app/lists is still a bookmark, still
  // where a reload lands, and still where you are standing when you switch the
  // feature off from Settings. Falling back to the day view is the other half of
  // what `features.lists` has to mean — see NavList for the tab itself.
  const ActiveView = view === 'lists' && !features.lists ? ROUTES.day : ROUTES[view];

  return (
    // The app is the viewport, not the document: it is exactly one screen tall and
    // the view inside it does the scrolling. That is what lets the nav, the sync
    // banner and each view's own header stay put while its content moves — with the
    // document scrolling, every one of them would need an offset for whatever sits
    // above it. `dvh` rather than `vh` so a phone's collapsing address bar doesn't
    // leave the bottom of the app under it.
    <div className="flex h-dvh flex-col md:flex-row bg-white text-neutral-825 antialiased" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      {loading && <Loader overlay={false} />}

      <Sidebar {...repoProps} />

      {/* `min-h-0` so the view below can be shorter than its content and scroll,
          rather than pushing this column past the bottom of the screen. */}
      <main className="flex flex-1 min-w-0 min-h-0 flex-col">
        {/* Above the view rather than inside it: every view scrolls its own
            content, and this has to stay put in all of them. */}
        <SyncStatusBar />
        {/* Only the lazy routes ever suspend, and only on the first visit to one —
            the same progress bar the store's own load uses, so it reads as the app
            fetching rather than as a broken tab. */}
        <React.Suspense fallback={<Loader />}>
          {noClients ? <EmptyClientsView /> : formOpen ? <TaskFormPage /> : taskOpen ? <TaskDetailPanel /> : <ActiveView />}
        </React.Suspense>
      </main>

      {searchOpen && <SearchOverlay />}
      {clientModalOpen && <ClientFormModal />}

      {/* Layers over everything, including the task form, and swallows the keys
          while it's up — see ConfirmDialog. */}
      <ConfirmDialog />

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
