import React from 'react';
import { useData, useUi } from '../context';
import { FolderSyncIcon, PlusIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';
import { post } from '../vscodeApi';

const navClass = (active: boolean) =>
  'flex items-center gap-[7px] px-[13px] py-[7px] rounded-[7px] text-[13.5px] cursor-pointer hover:bg-[#F6F7F9] ' +
  (active ? 'font-semibold bg-[#FBEFC0] border border-[#EAD27A] text-[#3A2E05]' : 'font-medium bg-white border border-transparent text-[#3C4149]');

/** Shared base for the right-aligned action buttons so icon-only and labelled buttons share one height. */
const actionBase =
  'relative flex items-center justify-center gap-[6px] h-[32px] border rounded-[7px] text-[13px] cursor-pointer';

/** Top navigation bar: brand, tab buttons, git-sync and new-task actions. */
export function NavBar() {
  const { view, setView, searchOpen, setSearchOpen } = useUi();
  const { noClients, triggerGitSync: onGitSync, openModal: onNewTask, gitPending } = useData();
  return (
    <div className="flex items-center gap-1 px-4 py-[10px] border-b border-[#E5E7EB] shrink-0">
      <div className="flex items-center gap-2 font-bold text-[15px] pl-1 pr-3 mr-2">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#1F2328" strokeWidth="1.5">
          <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" />
          <path d="M5.5 4.5V3.5a1 1 0 011-1h3a1 1 0 011 1v1" />
        </svg>
        Worklog
      </div>

      {!noClients && (
        <>
          <button onClick={() => setView('day')} className={navClass(view === 'day')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
              <path d="M4.5 6h7M4.5 8.5h7M4.5 11h4" />
            </svg>
            Day
          </button>
          <button onClick={() => setView('calendar')} className={navClass(view === 'calendar')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="11" rx="1.5" />
              <path d="M2 6h12M5 1.5v2M11 1.5v2" />
              <rect x="4.5" y="8" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
              <rect x="9.5" y="8" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
            </svg>
            Calendar
          </button>
          <button onClick={() => setView('clients')} className={navClass(view === 'clients')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" />
              <path d="M5.5 4.5V3.5a1 1 0 011-1h3a1 1 0 011 1v1" />
            </svg>
            Clients
          </button>
          <button onClick={() => setView('insights')} className={navClass(view === 'insights')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 4.5V8l2.5 1.5" />
            </svg>
            Insights
          </button>
          <button onClick={() => setView('archive')} className={navClass(view === 'archive')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 5.5h12" />
              <rect x="2" y="3" width="12" height="3" rx="1" />
              <path d="M3.5 6v6.5a1 1 0 001 1h7a1 1 0 001-1V6" />
            </svg>
            Archive
          </button>
        </>
      )}

      <div className="flex-1" />


      <button
        onClick={() => post({ type: 'reloadWebview' })}
        className={actionBase + ' px-[12px] font-medium border-[#D0D7DE] bg-white text-[#3C4149] hover:bg-[#F6F7F9]'}
        title="Refresh (⌘R)"
      >
        <RefreshCwIcon size={14} />
        <span className="sr-only">Refresh</span>
      </button>

      <button
        onClick={() => {
          setSearchOpen(true);
          requestAnimationFrame(() => document.getElementById('worklog-search-input')?.focus());
        }}
        className={actionBase + ' px-[12px] font-medium border-[#D0D7DE] bg-white text-[#3C4149] hover:bg-[#F6F7F9]'}
      >
        <SearchIcon size={14} />
        <span className="sr-only">Search</span>
      </button>

      <button
        onClick={onGitSync}
        className={
          actionBase + ' px-[12px] font-medium ' +
          (gitPending
            ? 'border-[#E2BE2E] bg-[#FBEFC0] text-[#3A2E05] hover:bg-[#F8E7A2]'
            : 'border-[#D0D7DE] bg-white text-[#3C4149] hover:bg-[#F6F7F9]')
        }
        title={
          gitPending
            ? 'Uncommitted changes — commit all changes, pull, and push'
            : 'Commit all changes, pull, and push'
        }
      >
        <FolderSyncIcon size={14} />
        Git sync
        {gitPending && (
          <span className="absolute -top-[3px] -right-[3px] w-[9px] h-[9px] rounded-full bg-[#E2BE2E] border-2 border-white" />
        )}
      </button>

      {!noClients && (
        <button
          onClick={onNewTask}
          className={actionBase + ' px-[14px] font-semibold border-[#E2BE2E] bg-[#F4CF4D] text-[#3A2E05] hover:bg-[#F2C835]'}
        >
          <PlusIcon size={14} />
          New task
        </button>
      )}
    </div>
  );
}
