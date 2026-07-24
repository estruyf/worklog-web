// The client island for /app. Resolves the GitHub session, lets the user pick a
// repository, opens it through the store (which loads + parses the Worklog files),
// and mounts the dashboard. The current route (/app or /app/task/<id>) picks
// between the dashboard and a single-task page. A floating control switches repo
// or signs out. One repo is mounted at a time. The selected repo is remembered in
// localStorage (not the URL) so a return visit reopens it automatically.

import React from 'react';
import { WorklogApp } from './WorklogApp';
import { TaskPage } from './TaskPage';
import { worklogStore } from '../data/worklogStore';
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

  const open = React.useCallback((ref: RepoRef) => {
    setRepo(ref);
    setPhase({ kind: 'loading', label: `Loading ${ref.owner}/${ref.repo}…` });
    localStorage.setItem(LAST_REPO_KEY, JSON.stringify(ref));

    worklogStore
      .open(ref.owner, ref.repo, ref.branch)
      .then(() => setPhase({ kind: 'ready' }))
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

  return route.name === 'task' ? (
    <TaskPage taskId={route.taskId} />
  ) : (
    <WorklogApp repoProps={{ repo, onSwitchRepo: switchRepo, onSignOut: signOut }} />
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div style={splashStyle}>
      <div className="spinner" />
      <div style={{ color: '#57606a', fontSize: 15 }}>{label}</div>
      <style>{`.spinner{width:30px;height:30px;border:3px solid #d0d7de;border-top-color:#1f6feb;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ErrorScreen({ message, onRetry, onSwitch }: { message: string; onRetry: () => void; onSwitch: () => void }) {
  const looksMissing = /404|not found|could not|no ref|not a worklog/i.test(message);
  return (
    <div style={{ ...splashStyle, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <h2 style={{ margin: 0, color: '#1f2328' }}>Couldn’t open this repository</h2>
      <p style={{ color: '#57606a', maxWidth: 460 }}>
        {looksMissing
          ? 'This repo may not have a Worklog layout (a .worklog/config.json plus clients/, worklog/ and archive/ folders), or the branch was not found.'
          : message}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRetry} style={btnPrimary}>Retry</button>
        <button onClick={onSwitch} style={btnSecondary}>Pick another repo</button>
      </div>
    </div>
  );
}

function NotFoundScreen({ onHome }: { onHome: () => void }) {
  return (
    <div style={{ ...splashStyle, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: '#8b949e' }}>404</div>
      <h2 style={{ margin: 0, color: '#1f2328' }}>Page not found</h2>
      <p style={{ color: '#57606a', maxWidth: 420 }}>This page doesn’t exist. It may have been removed or the link was mistyped.</p>
      <button onClick={onHome} style={btnPrimary}>Back to Worklog</button>
    </div>
  );
}

const splashStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
};
const btnPrimary: React.CSSProperties = { background: '#1f6feb', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: '#eaeef2', color: '#1f2328', border: 'none', padding: '9px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
