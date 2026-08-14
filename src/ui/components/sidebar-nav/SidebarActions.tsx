import React from 'react';
import type { AppView } from '../../model';
import {
  CloudOffIcon,
  ExternalLinkIcon,
  FolderSyncIcon,
  KeyboardIcon,
  MessageSquarePlusIcon,
  PuzzleIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
} from 'lucide-react';
import { useData, useUi } from '../../context';
import { CHANGELOG_PATH, CHROME_EXTENSION_URL, NEW_ISSUE_URL } from '../../../model/links';
import { actionClass } from './styles';

/** The rail's bottom block: the things you reach for from any view. Search and
 *  Git sync do something; Shortcuts and Settings are views, so they light up
 *  when you are on them.
 *
 *  Offline, Git sync becomes the offline indicator rather than being disabled:
 *  it is the one control in the app that means "reach GitHub", so it is where
 *  someone looks to find out why nothing has. Still pressable — the store answers
 *  with what it is doing instead of the sync it can't make.
 *
 *  `collapsed` is the icons-only rail: every label drops to its `title`, which is
 *  why each row carries one whether or not it needs a tooltip when wide. */
export function SidebarActions({
  onGo,
  onNavigate,
  collapsed = false,
}: {
  onGo: (view: AppView) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { view, setSearchOpen } = useUi();
  const { triggerGitSync, gitPending, offline } = useData();

  const openSearch = () => {
    setSearchOpen(true);
    onNavigate?.();
    requestAnimationFrame(() => document.getElementById('worklog-search-input')?.focus());
  };

  return (
    <div className="flex flex-col gap-[3px] px-[10px] pb-4 pt-3 border-t border-neutral-300">
      <button
        onClick={openSearch}
        className={actionClass(collapsed) + ' border-transparent text-neutral-750 hover:bg-neutral-200'}
        title="Search (⌘/Ctrl+F)"
      >
        <SearchIcon size={15} />
        {!collapsed && 'Search'}
      </button>

      <button
        onClick={() => {
          triggerGitSync();
          onNavigate?.();
        }}
        className={
          actionClass(collapsed) +
          (gitPending || offline
            ? ' border-brand-500 bg-brand-225 text-brand-800 hover:bg-brand-325'
            : ' border-transparent text-neutral-750 hover:bg-neutral-200')
        }
        title={
          offline
            ? gitPending
              ? 'Offline — your changes are saved on this device and will sync when you reconnect'
              : 'Offline — showing the last version synced to this device'
            : gitPending
              ? 'Uncommitted changes — commit all changes, pull, and push'
              : 'Commit all changes, pull, and push'
        }
      >
        {offline ? <CloudOffIcon size={15} /> : <FolderSyncIcon size={15} />}
        {!collapsed && (offline ? 'Offline' : 'Git sync')}
        {/* Collapsed there is no row left to sit at the end of, so the dot rides
            the corner of the glyph the way the nav counts do. */}
        {gitPending && (
          <span className={collapsed ? 'absolute top-0 right-0 w-[9px] h-[9px] rounded-full bg-brand-500' : 'ml-auto w-[9px] h-[9px] rounded-full bg-brand-500'} />
        )}
      </button>

      <button
        onClick={() => onGo('shortcuts')}
        className={
          actionClass(collapsed) +
          (view === 'shortcuts' ? ' border-brand-425 bg-brand-225 text-brand-800' : ' border-transparent text-neutral-750 hover:bg-neutral-200')
        }
        title="Keyboard shortcuts"
      >
        <KeyboardIcon size={15} strokeWidth={1.5} />
        {!collapsed && 'Shortcuts'}
      </button>

      <button
        onClick={() => onGo('settings')}
        className={
          actionClass(collapsed) +
          (view === 'settings' ? ' border-brand-425 bg-brand-225 text-brand-800' : ' border-transparent text-neutral-750 hover:bg-neutral-200')
        }
        title="Settings"
      >
        <SettingsIcon size={15} strokeWidth={1.5} />
        {!collapsed && 'Settings'}
      </button>

      {/* Deliberately the quietest row in the block: it leaves the app, and it is
          here to be found once rather than reached for daily. Muted until hover,
          so it reads as a footnote to the actions above it. */}
      <a
        href={CHROME_EXTENSION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={actionClass(collapsed) + ' no-underline border-transparent text-neutral-650 hover:bg-neutral-200 hover:text-neutral-750'}
        title="Worklog for Chrome — add tasks straight from GitHub and Productive"
      >
        <PuzzleIcon size={15} strokeWidth={1.5} />
        {!collapsed && (
          <>
            Browser extension
            <ExternalLinkIcon size={12} className="ml-auto shrink-0" />
          </>
        )}
      </a>

      {/* Same quiet treatment, and a new tab for the same reason: the changelog is
          served outside the app's router, so following it in place would tear down
          the island — and with it anything not yet committed. */}
      <a
        href={CHANGELOG_PATH}
        target="_blank"
        rel="noopener noreferrer"
        className={actionClass(collapsed) + ' no-underline border-transparent text-neutral-650 hover:bg-neutral-200 hover:text-neutral-750'}
        title="What's new — every change to Worklog, by day"
      >
        <SparklesIcon size={15} strokeWidth={1.5} />
        {!collapsed && (
          <>
            What's new
            <ExternalLinkIcon size={12} className="ml-auto shrink-0" />
          </>
        )}
      </a>

      {/* Feedback goes to Worklog's own issue tracker, in a new tab like the two
          rows above: it is a GitHub form, not part of the app, and losing the
          island to it would take uncommitted edits with it. */}
      <a
        href={NEW_ISSUE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={actionClass(collapsed) + ' no-underline border-transparent text-neutral-650 hover:bg-neutral-200 hover:text-neutral-750'}
        title="Report an issue or send feedback — opens a new issue on GitHub"
      >
        <MessageSquarePlusIcon size={15} strokeWidth={1.5} />
        {!collapsed && (
          <>
            Report an issue
            <ExternalLinkIcon size={12} className="ml-auto shrink-0" />
          </>
        )}
      </a>
    </div>
  );
}
