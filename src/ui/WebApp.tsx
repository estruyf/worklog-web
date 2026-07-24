// The client island for /app. Resolves the GitHub session, lets the user pick a
// repository, opens it through the store (which loads + parses the Worklog files),
// and mounts the dashboard. The current route (/app or /app/task/<id>) picks
// between the dashboard and a single-task page. A floating control switches repo
// or signs out. One repo is mounted at a time. The selected repo is remembered in
// localStorage (not the URL) so a return visit reopens it automatically.

import React from 'react';
import { WorklogApp } from './WorklogApp';
import { TaskPage } from './TaskPage';
import { worklogStore, type RecoveryInfo } from '../data/worklogStore';
import { navigateToDashboard, useRoute } from './router';
import { RepoPicker } from './RepoPicker';
import './styles.css';

const LAST_REPO_KEY = 'worklog:lastRepo';

type Phase = { kind: 'picker' } | { kind: 'loading'; label: string } | { kind: 'ready' } | { kind: 'error'; message: string };

interface RepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

function readLastRepo(): RepoRef | undefined {
  try {
    const raw = localStorage.getItem(LAST_REPO_KEY);
    return raw ? (JSON.parse(raw) as RepoRef) : undefined;
  } catch {
    return undefined;
  }
}

export default function WebApp() {
  const route = useRoute();
  const initialRepo = React.useMemo(readLastRepo, []);
  const [phase, setPhase] = React.useState<Phase>(initialRepo ? { kind: 'loading', label: `Loading ${initialRepo.owner}/${initialRepo.repo}…` } : { kind: 'picker' });
  const [repo, setRepo] = React.useState<RepoRef | undefined>(initialRepo);
  const [recovery, setRecovery] = React.useState<RecoveryInfo | null>(null);

  const open = React.useCallback((ref: RepoRef) => {
    setRepo(ref);
    setRecovery(null);
    setPhase({ kind: 'loading', label: `Loading ${ref.owner}/${ref.repo}…` });
    localStorage.setItem(LAST_REPO_KEY, JSON.stringify(ref));

    worklogStore
      .open(ref.owner, ref.repo, ref.branch)
      .then(() => {
        setPhase({ kind: 'ready' });
        // If unsynced edits from a previous session were recovered, ask the user.
        setRecovery(worklogStore.getRecovery());
      })
      .catch((err) => setPhase({ kind: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, []);

  React.useEffect(() => {
    if (initialRepo) {
      open(initialRepo);
    }
  }, [initialRepo, open]);

  const switchRepo = React.useCallback(() => {
    setRepo(undefined);
    setPhase({ kind: 'picker' });
  }, []);

  const signOut = React.useCallback(() => {
    localStorage.removeItem(LAST_REPO_KEY);
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/';
    });
  }, []);

  // An unknown /app/* sub-path is a 404 regardless of repo/session state.
  if (route.name === 'notFound') {
    return <NotFoundScreen onHome={navigateToDashboard} />;
  }
  if (phase.kind === 'picker') {
    return <RepoPicker onPick={open} lastRepo={readLastRepo()} />;
  }
  if (phase.kind === 'loading') {
    return <Splash label={phase.label} />;
  }
  if (phase.kind === 'error') {
    return <ErrorScreen message={phase.message} onRetry={() => repo && open(repo)} onSwitch={switchRepo} />;
  }

  const restore = React.useCallback(() => {
    worklogStore.restorePending().finally(() => setRecovery(null));
  }, []);
  const discard = React.useCallback(() => {
    worklogStore.discardPending().finally(() => setRecovery(null));
  }, []);

  return (
    <>
      {route.name === 'task' ? (
        <TaskPage taskId={route.taskId} />
      ) : (
        <WorklogApp repoProps={{ repo, onSwitchRepo: switchRepo, onSignOut: signOut }} />
      )}
      {recovery && <RecoveryPrompt info={recovery} onRestore={restore} onDiscard={discard} />}
    </>
  );
}

/** Format an epoch-millis timestamp as a short, human-friendly age. */
function timeAgo(ms: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Offered on open when unsynced edits from a previous session were recovered from
 *  local storage. Restore merges them back in (ready to sync); Discard drops them. */
function RecoveryPrompt({ info, onRestore, onDiscard }: { info: RecoveryInfo; onRestore: () => void; onDiscard: () => void }) {
  const { fileCount, savedAt, baseChanged } = info;
  return (
    <div className="fixed inset-0 bg-[rgba(30,33,40,0.45)] flex items-start justify-center pt-[12vh] z-60">
      <div className="bg-white rounded-[14px] w-115 max-w-[92vw] px-7.5 pt-6.5 pb-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-[20px] font-bold m-0 mb-3">Recover unsynced changes?</h2>
        <p className="text-[14px] text-[#57606a] m-0 mb-2 leading-relaxed">
          {fileCount === 1 ? '1 file was' : `${fileCount} files were`} edited but never synced to GitHub before this tab was
          closed, saved locally {timeAgo(savedAt)}.
        </p>
        {baseChanged && (
          <p className="text-[13px] text-[#9a6700] bg-[#FFF8C5] border border-[#EBDFA8] rounded-[9px] px-3 py-2 m-0 mb-2">
            Heads up: this branch changed on GitHub since then. Restoring will re-apply your local edits on top of the
            latest version.
          </p>
        )}
        <p className="text-[13px] text-[#8a9099] m-0 mb-5.5">Restore to continue where you left off, then sync when ready.</p>
        <div className="flex justify-end gap-2.5">
          <button onClick={onDiscard} className="px-5 py-2.5 border border-[#E5E7EB] rounded-[9px] bg-[#F1F2F4] text-[14px] font-semibold cursor-pointer">
            Discard
          </button>
          <button onClick={onRestore} className="px-5.5 py-2.5 rounded-[9px] text-[14px] font-semibold border border-[#E2BE2E] bg-[#F4CF4D] text-[#3A2E05] cursor-pointer">
            Restore changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className={splashCls}>
      <div className="w-7.5 h-7.5 border-[3px] border-[#e5e7eb] border-t-[#e2be2e] rounded-full animate-spin" />
      <div className="text-[15px] text-[#57606a]">{label}</div>
    </div>
  );
}

function ErrorScreen({ message, onRetry, onSwitch }: { message: string; onRetry: () => void; onSwitch: () => void }) {
  const looksMissing = /404|not found|could not|no ref|not a worklog/i.test(message);
  return (
    <div className={`${splashCls} p-6 text-center`}>
      <div className="text-[40px]">😕</div>
      <h2 className="m-0 text-[#1f2328]">Couldn’t open this repository</h2>
      <p className="max-w-115 text-[#57606a]">
        {looksMissing
          ? 'This repo may not have a Worklog layout (a .worklog/config.json plus clients/, worklog/ and archive/ folders), or the branch was not found.'
          : message}
      </p>
      <div className="flex gap-2.5">
        <button onClick={onRetry} className={btnPrimaryCls}>Retry</button>
        <button onClick={onSwitch} className={btnSecondaryCls}>Pick another repo</button>
      </div>
    </div>
  );
}

function NotFoundScreen({ onHome }: { onHome: () => void }) {
  return (
    <div className={`${splashCls} p-6 text-center`}>
      <div className="text-[13px] font-bold tracking-[0.08em] text-[#8a9099]">404</div>
      <h2 className="m-0 text-[#1f2328]">Page not found</h2>
      <p className="max-w-105 text-[#57606a]">This page doesn’t exist. It may have been removed or the link was mistyped.</p>
      <button onClick={onHome} className={btnPrimaryCls}>Back to Worklog</button>
    </div>
  );
}

const splashCls = 'min-h-screen flex flex-col gap-4 items-center justify-center bg-white';
const btnPrimaryCls = 'bg-[#f4cf4d] text-[#3a2e05] border border-[#e2be2e] px-4 py-[9px] rounded-lg font-semibold cursor-pointer';
const btnSecondaryCls = 'bg-[#f1f2f4] text-[#1f2328] border border-[#e5e7eb] px-4 py-[9px] rounded-lg font-semibold cursor-pointer';
