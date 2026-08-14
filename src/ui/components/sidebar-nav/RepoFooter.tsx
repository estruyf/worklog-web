import React from 'react';
import { ChevronsUpDownIcon, GithubIcon, LogOutIcon } from 'lucide-react';
import { SectionLabel } from '../../primitives';
import { actionClass } from './styles';

/** Repo/session controls rendered at the very bottom of the rail. Optional so the
 * single-task page can mount the Sidebar-less layout without a repo picker or auth. */
export interface SidebarRepoProps {
  repo?: { owner: string; repo: string; branch?: string };
  onSwitchRepo?: () => void;
  onSignOut?: () => void;
}

/** Repository + session footer: which repo is open, plus switch / GitHub / sign-out.
 *  Collapsed, the repo name has nowhere to fit, so the switch row becomes its
 *  glyph and carries owner/repo in the tooltip instead. */
export function RepoFooter({ repo, onSwitchRepo, onSignOut, collapsed = false }: SidebarRepoProps & { collapsed?: boolean }) {
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
