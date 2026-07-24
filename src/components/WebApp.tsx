// The client island for /app. Resolves the GitHub session, lets the user pick a
// repository, opens it through the bridge (which loads + parses the Worklog
// files), and mounts the ported dashboard. A floating control switches repo or
// signs out. One repo is mounted at a time.

import React from 'react';
import { WorklogApp } from '../webview/WorklogApp';
import { TaskWindow } from '../webview/TaskWindow';
import { bridge } from '../host/bridge';
import { RepoPicker } from './RepoPicker';
import '../webview/styles.css';

const LAST_REPO_KEY = 'worklog:lastRepo';

type Phase = { kind: 'picker' } | { kind: 'loading'; label: string } | { kind: 'ready' } | { kind: 'error'; message: string };

interface RepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

function readRepoFromUrl(): RepoRef | undefined {
  const p = new URLSearchParams(window.location.search);
  const owner = p.get('owner');
  const repo = p.get('repo');
  if (owner && repo) {
    return { owner, repo, branch: p.get('branch') ?? undefined };
  }
  return undefined;
}

export default function WebApp() {
  // A standalone single-task view (?task=<id>) opened from "open in new tab".
  const taskId = React.useMemo(() => new URLSearchParams(window.location.search).get('task') ?? undefined, []);
  const initialRepo = React.useMemo(readRepoFromUrl, []);
  const [phase, setPhase] = React.useState<Phase>(initialRepo ? { kind: 'loading', label: `Loading ${initialRepo.owner}/${initialRepo.repo}…` } : { kind: 'picker' });
  const [repo, setRepo] = React.useState<RepoRef | undefined>(initialRepo);

  const open = React.useCallback((ref: RepoRef) => {
    setRepo(ref);
    setPhase({ kind: 'loading', label: `Loading ${ref.owner}/${ref.repo}…` });
    const url = new URL(window.location.href);
    url.searchParams.set('owner', ref.owner);
    url.searchParams.set('repo', ref.repo);
    if (ref.branch) {
      url.searchParams.set('branch', ref.branch);
    } else {
      url.searchParams.delete('branch');
    }
    window.history.replaceState(null, '', url);
    localStorage.setItem(LAST_REPO_KEY, JSON.stringify(ref));

    bridge
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
    const url = new URL(window.location.href);
    url.searchParams.delete('owner');
    url.searchParams.delete('repo');
    url.searchParams.delete('branch');
    window.history.replaceState(null, '', url);
    setRepo(undefined);
    setPhase({ kind: 'picker' });
  }, []);

  if (phase.kind === 'picker') {
    return <RepoPicker onPick={open} lastRepo={readLastRepo()} />;
  }
  if (phase.kind === 'loading') {
    return <Splash label={phase.label} />;
  }
  if (phase.kind === 'error') {
    return <ErrorScreen message={phase.message} onRetry={() => repo && open(repo)} onSwitch={switchRepo} />;
  }

  return (
    <>
      {taskId ? <TaskWindow taskId={taskId} /> : <WorklogApp />}
      {!taskId && <RepoControl repo={repo!} onSwitch={switchRepo} />}
    </>
  );
}

function readLastRepo(): RepoRef | undefined {
  try {
    const raw = localStorage.getItem(LAST_REPO_KEY);
    return raw ? (JSON.parse(raw) as RepoRef) : undefined;
  } catch {
    return undefined;
  }
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

function RepoControl({ repo, onSwitch }: { repo: RepoRef; onSwitch: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'fixed', top: 10, right: 14, zIndex: 60 }}>
      <button onClick={() => setOpen((v) => !v)} style={repoPill} title="Repository">
        <span style={{ opacity: 0.6 }}>repo</span> {repo.owner}/{repo.repo}
      </button>
      {open && (
        <div style={repoMenu} onMouseLeave={() => setOpen(false)}>
          <button style={menuItem} onClick={onSwitch}>Switch repository…</button>
          <a style={menuItem} href={`https://github.com/${repo.owner}/${repo.repo}`} target="_blank" rel="noopener">Open on GitHub ↗</a>
          <form method="post" action="/api/auth/logout" onSubmit={() => localStorage.removeItem(LAST_REPO_KEY)}>
            <button style={{ ...menuItem, width: '100%', color: '#cf222e' }} type="submit" formAction="/api/auth/logout">Sign out</button>
          </form>
        </div>
      )}
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
const repoPill: React.CSSProperties = { background: '#fff', border: '1px solid #d0d7de', borderRadius: 8, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer', boxShadow: '0 1px 3px rgba(31,35,40,.08)', color: '#1f2328' };
const repoMenu: React.CSSProperties = { marginTop: 6, background: '#fff', border: '1px solid #d0d7de', borderRadius: 10, boxShadow: '0 8px 24px rgba(31,35,40,.12)', overflow: 'hidden', minWidth: 200 };
const menuItem: React.CSSProperties = { display: 'block', padding: '9px 12px', fontSize: 13, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#1f2328', textDecoration: 'none' };
