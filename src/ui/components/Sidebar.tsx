import React from 'react';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import {
  ChevronsUpDownIcon,
  FolderSyncIcon,
  GithubIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-react';
import type { AppView } from '../model';
import { isGeneralTodoClientId } from '../../model/todos';
import { clientIdOf, isDone } from '../utils';

/** Repo/session controls rendered at the very bottom of the rail. Optional so the
 * single-task page can mount the Sidebar-less layout without a repo picker or auth. */
export interface SidebarRepoProps {
  repo?: { owner: string; repo: string; branch?: string };
  onSwitchRepo?: () => void;
  onSignOut?: () => void;
}

/** Nav tabs, in display order. Each keeps the app's tuned inline glyph. */
const NAV_ITEMS: { view: AppView; label: string; icon: React.ReactNode }[] = [
  {
    view: 'day',
    label: 'Day',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
        <path d="M4.5 6h7M4.5 8.5h7M4.5 11h4" />
      </svg>
    ),
  },
  {
    view: 'todos',
    label: 'To-dos',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1.5 3.5L3 5l2.5-2.5M1.5 8L3 9.5 5.5 7M1.5 12.5L3 14l2.5-2.5" />
        <path d="M8 4h6.5M8 8.5h6.5M8 13h6.5" />
      </svg>
    ),
  },
  {
    view: 'calendar',
    label: 'Calendar',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="12" height="11" rx="1.5" />
        <path d="M2 6h12M5 1.5v2M11 1.5v2" />
        <rect x="4.5" y="8" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
        <rect x="9.5" y="8" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    view: 'clients',
    label: 'Clients',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" />
        <path d="M5.5 4.5V3.5a1 1 0 011-1h3a1 1 0 011 1v1" />
      </svg>
    ),
  },
  {
    view: 'insights',
    label: 'Insights',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 4.5V8l2.5 1.5" />
      </svg>
    ),
  },
  {
    view: 'archive',
    label: 'Archive',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 5.5h12" />
        <rect x="2" y="3" width="12" height="3" rx="1" />
        <path d="M3.5 6v6.5a1 1 0 001 1h7a1 1 0 001-1V6" />
      </svg>
    ),
  },
];

const brandGlyph = <img src="/worklog-logo-outline.svg" alt="" width="20" height="20" className="rounded-[5px]" />;

const navItemClass = (active: boolean) =>
  'flex items-center gap-[10px] w-full px-[12px] py-[9px] rounded-[8px] text-[13.5px] cursor-pointer text-left transition-colors ' +
  (active
    ? 'font-semibold bg-brand-225 border border-brand-425 text-brand-800'
    : 'font-medium bg-transparent border border-transparent text-neutral-750 hover:bg-neutral-200');

/** Full-width sidebar action button (Search / Git sync). */
const actionClass =
  'relative flex items-center gap-[10px] w-full px-[12px] py-[8px] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors border';

/** Repository + session footer: which repo is open, plus switch / GitHub / sign-out. */
function RepoFooter({ repo, onSwitchRepo, onSignOut }: SidebarRepoProps) {
  if (!repo) {
    return null;
  }
  return (
    <div className="flex flex-col gap-[3px] px-[10px] pb-4 pt-3 border-t border-neutral-300">
      <div className="text-[10.5px] font-semibold tracking-[0.06em] text-neutral-650 px-[3px] mb-[3px]">REPOSITORY</div>

      <button
        onClick={onSwitchRepo}
        className={actionClass + ' border-neutral-400 bg-white text-neutral-750 hover:bg-neutral-200'}
        title="Switch repository"
      >
        <span className="truncate">
          <span className="text-neutral-650">{repo.owner}/</span>
          <span className="font-semibold">{repo.repo}</span>
        </span>
        <ChevronsUpDownIcon size={14} className="ml-auto shrink-0 text-neutral-650" />
      </button>

      <a
        href={`https://github.com/${repo.owner}/${repo.repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className={actionClass + ' no-underline border-transparent text-neutral-750 hover:bg-neutral-200'}
      >
        <GithubIcon size={15} />
        Open on GitHub
      </a>

      <button
        onClick={onSignOut}
        className={actionClass + ' border-transparent text-danger-700 hover:bg-danger-100'}
      >
        <LogOutIcon size={15} />
        Sign out
      </button>
    </div>
  );
}

/** The shared inner content — rendered once for the static desktop rail and once
 * for the mobile drawer. `onNavigate` lets the drawer close itself on selection. */
function SidebarContent({ onNavigate, repoProps }: { onNavigate?: () => void; repoProps?: SidebarRepoProps }) {
  const { view, setSearchOpen, setDetailId } = useUi();
  const { noClients, tasks, triggerGitSync: onGitSync, openModal: onNewTask, gitPending } = useData();

  // Open general to-dos get a count badge — they're the one nav target whose list
  // isn't tied to the selected day, so nothing else surfaces that they're waiting.
  const todoCount = React.useMemo(
    () => tasks.filter((t) => isGeneralTodoClientId(clientIdOf(t)) && !isDone(t)).length,
    [tasks],
  );

  const go = (v: AppView) => {
    setDetailId(null);
    navigateToView(v);
    onNavigate?.();
  };

  const openSearch = () => {
    setSearchOpen(true);
    onNavigate?.();
    requestAnimationFrame(() => document.getElementById('worklog-search-input')?.focus());
  };

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => go('day')}
        className="flex items-center gap-2 font-bold text-[15px] px-[10px] h-[52px] shrink-0 cursor-pointer bg-transparent border-none text-left"
        title="Go to Day view"
      >
        {brandGlyph}
        Worklog
      </button>

      {!noClients && (
        <>
          <div className="px-[10px] pb-3">
            <button
              onClick={() => {
                onNewTask();
                onNavigate?.();
              }}
              className="flex items-center justify-center gap-[7px] w-full px-[14px] py-[9px] rounded-[8px] text-[13px] font-semibold cursor-pointer border border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475"
              title="New task (⇧N)"
            >
              <PlusIcon size={15} />
              New task
              <kbd className="inline-flex items-center justify-center h-[18px] px-[5px] rounded-[5px] border border-brand-500 bg-brand-225 text-brand-800 text-[11px] font-medium leading-none">
                ⇧N
              </kbd>
            </button>
          </div>

          <nav className="flex flex-col gap-[3px] px-[10px]">
            {NAV_ITEMS.map((item) => (
              <button key={item.view} onClick={() => go(item.view)} className={navItemClass(view === item.view)}>
                <span className="shrink-0">{item.icon}</span>
                {item.label}
                {item.view === 'todos' && todoCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-neutral-325 text-neutral-675 text-[11.5px] font-semibold">
                    {todoCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-[3px] px-[10px] pb-4 pt-3 border-t border-neutral-300">
        <button onClick={openSearch} className={actionClass + ' border-transparent text-neutral-750 hover:bg-neutral-200'}>
          <SearchIcon size={15} />
          Search
        </button>

        <button
          onClick={() => {
            onGitSync();
            onNavigate?.();
          }}
          className={
            actionClass +
            (gitPending
              ? ' border-brand-500 bg-brand-225 text-brand-800 hover:bg-brand-325'
              : ' border-transparent text-neutral-750 hover:bg-neutral-200')
          }
          title={
            gitPending
              ? 'Uncommitted changes — commit all changes, pull, and push'
              : 'Commit all changes, pull, and push'
          }
        >
          <FolderSyncIcon size={15} />
          Git sync
          {gitPending && <span className="ml-auto w-[9px] h-[9px] rounded-full bg-brand-500" />}
        </button>

        <button
          onClick={() => go('settings')}
          className={
            actionClass +
            (view === 'settings'
              ? ' border-brand-425 bg-brand-225 text-brand-800'
              : ' border-transparent text-neutral-750 hover:bg-neutral-200')
          }
        >
          <SettingsIcon size={15} strokeWidth={1.5} />
          Settings
        </button>
      </div>

      <RepoFooter {...repoProps} />
    </div>
  );
}

/**
 * Left navigation rail. On md+ it's a static column in the app's flex-row shell;
 * below md it collapses to a top bar with a hamburger that slides the same
 * content in as an overlay drawer.
 */
export function Sidebar(repoProps: SidebarRepoProps = {}) {
  const [open, setOpen] = React.useState(false);
  const { openModal: onNewTask, noClients } = useData();
  const { setDetailId } = useUi();

  // Close the drawer on Escape and lock body scroll while it's open.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex md:hidden items-center gap-2 h-[52px] px-3 border-b border-neutral-400 shrink-0 sticky top-0 z-40 bg-white">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-[36px] h-[36px] rounded-[8px] border border-neutral-525 bg-white text-neutral-750 cursor-pointer hover:bg-neutral-200"
          aria-label="Open navigation"
        >
          <MenuIcon size={18} />
        </button>
        <button
          onClick={() => {
            setDetailId(null);
            navigateToView('day');
          }}
          className="flex items-center gap-2 font-bold text-[15px] cursor-pointer bg-transparent border-none text-left"
          title="Go to Day view"
        >
          {brandGlyph}
          Worklog
        </button>
        <div className="flex-1" />
        {!noClients && (
          <button
            onClick={onNewTask}
            className="flex items-center justify-center gap-[6px] px-[12px] h-[36px] rounded-[8px] text-[13px] font-semibold cursor-pointer border border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475"
          >
            <PlusIcon size={15} />
            New
          </button>
        )}
      </div>

      {/* Desktop static rail — pinned to the viewport so it never scrolls with the
          page content; `self-start` keeps the flex row from stretching it, which
          would leave sticky nothing to stick against. */}
      <aside className="hidden md:flex sticky top-0 self-start h-screen overflow-y-auto w-[228px] shrink-0 border-r border-neutral-400 bg-white">
        <div className="w-full">
          <SidebarContent repoProps={repoProps} />
        </div>
      </aside>

      {/* Mobile drawer + backdrop */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)} aria-hidden />
      )}
      <aside
        className={
          'md:hidden fixed inset-y-0 left-0 z-50 w-[248px] bg-white border-r border-neutral-400 shadow-xl transition-transform duration-200 ease-out ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-[13px] right-[12px] flex items-center justify-center w-[30px] h-[30px] rounded-[8px] text-neutral-700 cursor-pointer hover:bg-neutral-200"
          aria-label="Close navigation"
        >
          <XIcon size={17} />
        </button>
        <SidebarContent onNavigate={() => setOpen(false)} repoProps={repoProps} />
      </aside>
    </>
  );
}
