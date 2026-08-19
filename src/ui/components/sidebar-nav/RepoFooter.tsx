import React from 'react';
import { ChevronsUpDownIcon, GithubIcon, LogOutIcon } from 'lucide-react';
import { SectionLabel } from '../../primitives';
import { useData } from '../../context';
import { actionClass } from './styles';

/** Repo/session controls rendered at the very bottom of the rail. Optional so the
 * single-task page can mount the Sidebar-less layout without a repo picker or auth. */
export interface SidebarRepoProps {
  repo?: { owner: string; repo: string; branch?: string };
  onSwitchRepo?: () => void;
  onSignOut?: () => void;
}

/** "just now" under a minute, then minutes, then hours; a stamp older than a day
 *  is better said as the date than as "31 h ago". */
function syncedAgo(ts: number, now: number): string {
  const mins = Math.floor(Math.max(0, now - ts) / 60_000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins} min ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return `on ${new Date(ts).toLocaleDateString()}`;
}

/** Repository + session footer: which repo is open, plus switch / GitHub / sign-out.
 *  Collapsed, the repo name has nowhere to fit, so the switch row becomes its
 *  glyph and carries owner/repo in the tooltip instead. */
export function RepoFooter({ repo, onSwitchRepo, onSignOut, collapsed = false }: SidebarRepoProps & { collapsed?: boolean }) {
  const { lastSyncedAt } = useData();
  // A relative stamp that never re-renders would sit on "just now" all afternoon;
  // a minute tick keeps it honest at the granularity it displays.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!repo) {
    return null;
  }
  return (
    <div className="flex flex-col gap-[3px] px-[10px] pb-4 pt-3 border-t border-neutral-300">
      {!collapsed && (
        <SectionLabel size="sm" className="px-[3px] mb-[3px]">
          Repository
        </SectionLabel>
      )}

      <button
        onClick={onSwitchRepo}
        className={actionClass(collapsed) + ' border-neutral-400 bg-white text-neutral-750 hover:bg-neutral-200'}
        title={`Switch repository — ${repo.owner}/${repo.repo}`}
      >
        {!collapsed && (
          <span className="truncate">
            <span className="text-neutral-650">{repo.owner}/</span>
            <span className="font-semibold">{repo.repo}</span>
          </span>
        )}
        <ChevronsUpDownIcon size={14} className={collapsed ? 'shrink-0 text-neutral-650' : 'ml-auto shrink-0 text-neutral-650'} />
      </button>

      {!collapsed && lastSyncedAt !== null && (
        <span className="px-[3px] text-[11px] text-neutral-650">Synced {syncedAgo(lastSyncedAt, now)}</span>
      )}

      <a
        href={`https://github.com/${repo.owner}/${repo.repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className={actionClass(collapsed) + ' no-underline border-transparent text-neutral-750 hover:bg-neutral-200'}
        title="Open on GitHub"
      >
        <GithubIcon size={15} />
        {!collapsed && 'Open on GitHub'}
      </a>

      <button
        onClick={onSignOut}
        className={actionClass(collapsed) + ' border-transparent text-danger-700 hover:bg-danger-100'}
        title="Sign out"
      >
        <LogOutIcon size={15} />
        {!collapsed && 'Sign out'}
      </button>
    </div>
  );
}
