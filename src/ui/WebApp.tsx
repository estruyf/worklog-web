// The client island for /app. Resolves the GitHub session, lets the user pick a
// repository, opens it through the store (which loads + parses the Worklog files),
// and mounts the dashboard. The current route picks between the single-task page
// (/app/task/<id>) and the dashboard, which hosts the views and the task form
// (/app/new, /app/task/<id>/edit) inside its own chrome. A floating control
// switches repo or signs out. One repo is mounted at a time. The selected repo is
// remembered in localStorage (not the URL) so a return visit reopens it
// automatically.
//
// WorklogProvider wraps both: they share one set of UI state, so navigating to the
// form and back doesn't throw away the fields it was seeded with.

import React from 'react';
import { WorklogApp } from './WorklogApp';
import { TaskPage } from './TaskPage';
import { WorklogProvider } from './context';
import { Button, Modal } from './primitives';
import { UpdatePrompt } from './components';
import { useUnsavedGuard } from './hooks';
import { worklogStore, type RecoveryInfo } from '../data/worklogStore';
import { clearTrees } from '../data/repoCache';
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
  // Warn before leaving with unsynced edits (they're also mirrored for recovery).
  // Here rather than in the dashboard so it covers every route — the task form and
  // the single-task page can just as easily be where you close the tab.
  useUnsavedGuard();
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
    // The cached branch contents go with the session: it is a redundant copy of a
    // private repo, and leaving it readable after someone signs out on a shared
    // machine would be a decision nobody made. Unsynced edits are *not* cleared —
    // that snapshot is the only copy of work GitHub has never seen.
    void clearTrees();
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/';
    });
  }, []);

  const restore = React.useCallback(() => {
    worklogStore.restorePending().finally(() => setRecovery(null));
  }, []);
  const discard = React.useCallback(() => {
    worklogStore.discardPending().finally(() => setRecovery(null));
  }, []);

  // An unknown /app/* sub-path is a 404 regardless of repo/session state.
  // Each of these is wrapped rather than returned bare so UpdatePrompt is mounted
  // in every phase: the announcement fires once, and a prompt that only exists in
  // the ready phase would miss one that arrived while the repo was still loading.
  if (route.name === 'notFound') {
    return <Chrome><NotFoundScreen onHome={navigateToDashboard} /></Chrome>;
  }
  if (phase.kind === 'picker') {
    return <Chrome><RepoPicker onPick={open} lastRepo={readLastRepo()} /></Chrome>;
  }
  if (phase.kind === 'loading') {
    return <Chrome><Splash label={phase.label} /></Chrome>;
  }
  if (phase.kind === 'error') {
    return (
      <Chrome>
        <ErrorScreen message={phase.message} onRetry={() => repo && open(repo)} onSwitch={switchRepo} />
      </Chrome>
    );
  }

  return (
    <Chrome>
      <WorklogProvider>
        {route.name === 'task' ? (
          <TaskPage taskId={route.taskId} />
        ) : (
          <WorklogApp repoProps={{ repo, onSwitchRepo: switchRepo, onSignOut: signOut }} />
        )}
      </WorklogProvider>
      {recovery && <RecoveryPrompt info={recovery} onRestore={restore} onDiscard={discard} />}

      {/* Hidden visitor-stats pixel — an <img> still fetches its src while hidden,
          so this pings the counter once per app load without showing anything.
          Mounted out here rather than in the dashboard: routing to the task form
          and back remounts that, and each remount would count as another visit. */}
      <img
        src="https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2Fworklog.struyfconsulting.be&labelColor=%23e2be2e&countColor=%23e2be2e&slug=app"
        alt=""
        aria-hidden="true"
        width={1}
        height={1}
        loading="eager"
        className="absolute h-px w-px opacity-0 pointer-events-none -left-px -top-px"
      />
    </Chrome>
  );
}

/** Everything that outlives a phase change. Only the update prompt so far — it has
 *  to be mounted before the announcement arrives, and that can be any time. */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <UpdatePrompt />
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
    // No `onClose`: the two buttons are the only ways out, since dismissing this
    // would leave the recovered edits in limbo — neither restored nor discarded.
    <Modal role="alertdialog" layer="top" size="sm" title="Recover unsynced changes?">
      <p className="text-body text-neutral-700 m-0 mt-3 mb-2 leading-relaxed">
        {fileCount === 1 ? '1 file was' : `${fileCount} files were`} edited but never synced to GitHub before this tab was
        closed, saved locally {timeAgo(savedAt)}.
      </p>
      {baseChanged && (
        <p className="text-control text-brand-600 bg-brand-150 border border-brand-375 rounded-control-lg px-3 py-2 m-0 mb-2">
          Heads up: this branch changed on GitHub since then. Restoring will re-apply your local edits on top of the
          latest version.
        </p>
      )}
      <p className="text-control text-neutral-650 m-0 mb-5.5">Restore to continue where you left off, then sync when ready.</p>
      <div className="flex justify-end gap-2.5">
        <Button variant="neutral" size="lg" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="primary" size="lg" onClick={onRestore}>
          Restore changes
        </Button>
      </div>
    </Modal>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className={splashCls}>
      <div className="flex items-center gap-2.5">
        <img src="/worklog-logo-outline.svg" alt="" width={36} height={36} className="rounded-md" />
        <span className="font-bold text-[24px] text-neutral-825">Worklog</span>
      </div>
      <div className="w-7.5 h-7.5 border-[3px] border-neutral-400 border-t-brand-500 rounded-full animate-spin" />
      <div className="text-[15px] text-neutral-700">{label}</div>
    </div>
  );
}

function ErrorScreen({ message, onRetry, onSwitch }: { message: string; onRetry: () => void; onSwitch: () => void }) {
  const looksMissing = /404|not found|could not|no ref|not a worklog/i.test(message);
  return (
    <div className={`${splashCls} p-6 text-center`}>
      <div className="text-[40px]">😕</div>
      <h2 className="m-0 text-neutral-825">Couldn’t open this repository</h2>
      <p className="max-w-115 text-neutral-700">
        {looksMissing
          ? 'This repo may not have a Worklog layout (a .worklog/config.json plus clients/, worklog/ and archive/ folders), or the branch was not found.'
          : message}
      </p>
      <div className="flex gap-2.5">
        <Button variant="primary" size="md" onClick={onRetry}>Retry</Button>
        <Button variant="neutral" size="md" onClick={onSwitch}>Pick another repo</Button>
      </div>
    </div>
  );
}

function NotFoundScreen({ onHome }: { onHome: () => void }) {
  return (
    <div className={`${splashCls} p-6 text-center`}>
      <div className="text-control font-bold tracking-[0.08em] text-neutral-650">404</div>
      <h2 className="m-0 text-neutral-825">Page not found</h2>
      <p className="max-w-105 text-neutral-700">This page doesn’t exist. It may have been removed or the link was mistyped.</p>
      <Button variant="primary" size="md" onClick={onHome}>Back to Worklog</Button>
    </div>
  );
}

const splashCls = 'min-h-screen flex flex-col gap-4 items-center justify-center bg-white';
