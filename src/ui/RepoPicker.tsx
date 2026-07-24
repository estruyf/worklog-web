// Repository chooser shown before a timesheet is loaded. Lists the user's repos
// (most-recently-pushed first), supports search + manual `owner/repo` entry, and
// surfaces the last-opened repo for quick re-entry.

import React from 'react';

interface RepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  pushedAt: string | null;
}

type InitMode = 'create' | 'existing';

export function RepoPicker({ onPick, lastRepo }: { onPick: (ref: RepoRef) => void; lastRepo?: RepoRef }) {
  const [repos, setRepos] = React.useState<RepoSummary[] | null>(null);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [manual, setManual] = React.useState('');

  // "Initialize a new project" flow: scaffold a fresh Worklog layout into either
  // a brand-new repo or an existing (empty/non-Worklog) one, then open it.
  const [showInit, setShowInit] = React.useState(false);
  const [initMode, setInitMode] = React.useState<InitMode>('create');
  const [newName, setNewName] = React.useState('');
  const [newPrivate, setNewPrivate] = React.useState(true);
  const [existingRepo, setExistingRepo] = React.useState('');
  const [initBusy, setInitBusy] = React.useState(false);
  const [initError, setInitError] = React.useState('');

  React.useEffect(() => {
    fetch('/api/repos')
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = '/';
          return;
        }
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = (await res.json()) as { repos: RepoSummary[] };
        setRepos(data.repos);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const filtered = React.useMemo(() => {
    if (!repos) {
      return [];
    }
    const q = query.trim().toLowerCase();
    return q ? repos.filter((r) => r.fullName.toLowerCase().includes(q)) : repos;
  }, [repos, query]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const match = manual.trim().match(/^([^/\s]+)\/([^/\s@#]+)(?:[@#](.+))?$/);
    if (match) {
      onPick({ owner: match[1], repo: match[2], branch: match[3] });
    }
  };

  const submitInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInitError('');

    let payload: Record<string, unknown>;
    if (initMode === 'create') {
      const name = newName.trim();
      if (!name) {
        setInitError('Enter a name for the new repository.');
        return;
      }
      payload = { mode: 'create', name, private: newPrivate };
    } else {
      const match = existingRepo.trim().match(/^([^/\s]+)\/([^/\s@#]+)(?:[@#](.+))?$/);
      if (!match) {
        setInitError('Enter an existing repository as owner/repo.');
        return;
      }
      payload = { mode: 'existing', owner: match[1], repo: match[2], branch: match[3] };
    }

    setInitBusy(true);
    try {
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const ref = (await res.json()) as RepoRef;
      onPick(ref); // unmounts the picker; loading state is owned by the app shell.
    } catch (err) {
      setInitError(err instanceof Error ? err.message : String(err));
      setInitBusy(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={panel}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, color: '#1f2328' }}>Choose a timesheet repository</h1>
        <p style={{ margin: '0 0 18px', color: '#57606a', fontSize: 14 }}>
          Pick the repo that holds your Worklog files (<code>.worklog/config.json</code>, <code>clients/</code>, <code>worklog/</code>, <code>archive/</code>).
        </p>

        {lastRepo && (
          <button style={lastBtn} onClick={() => onPick(lastRepo)}>
            ↩ Reopen {lastRepo.owner}/{lastRepo.repo}
          </button>
        )}

        <form onSubmit={submitManual} style={{ display: 'flex', gap: 8, margin: '4px 0 14px' }}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="owner/repo (or owner/repo@branch)"
            style={input}
          />
          <button type="submit" style={goBtn}>Open</button>
        </form>

        <button type="button" style={initToggle} onClick={() => setShowInit((v) => !v)} aria-expanded={showInit}>
          <span style={{ fontWeight: 600 }}>＋ Initialize a new project</span>
          <span style={{ color: '#8b949e', fontSize: 18, lineHeight: 1 }}>{showInit ? '−' : '+'}</span>
        </button>

        {showInit && (
          <form onSubmit={submitInit} style={initPanel}>
            <p style={{ margin: '0 0 10px', color: '#57606a', fontSize: 13 }}>
              Scaffold an empty Worklog project (<code>.worklog/config.json</code> plus <code>clients/</code>, <code>worklog/</code> and{' '}
              <code>archive/</code>) into a new or existing repository.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => setInitMode('create')} style={initMode === 'create' ? segOn : segOff}>
                New repository
              </button>
              <button type="button" onClick={() => setInitMode('existing')} style={initMode === 'existing' ? segOn : segOff}>
                Existing repository
              </button>
            </div>

            {initMode === 'create' ? (
              <>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="repository name (e.g. my-timesheet)"
                  style={{ ...input, marginBottom: 10 }}
                  disabled={initBusy}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#57606a', marginBottom: 12 }}>
                  <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} disabled={initBusy} />
                  Private repository
                </label>
              </>
            ) : (
              <input
                value={existingRepo}
                onChange={(e) => setExistingRepo(e.target.value)}
                placeholder="owner/repo (or owner/repo@branch)"
                style={{ ...input, marginBottom: 12 }}
                disabled={initBusy}
              />
            )}

            {initError && <div style={{ color: '#cf222e', fontSize: 13, marginBottom: 10 }}>{initError}</div>}

            <button type="submit" style={{ ...goBtn, padding: '9px 16px', opacity: initBusy ? 0.7 : 1 }} disabled={initBusy}>
              {initBusy ? 'Initializing…' : 'Initialize & open'}
            </button>
          </form>
        )}

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories…" style={{ ...input, marginBottom: 10 }} />

        {error && <div style={{ color: '#cf222e', fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {!repos && !error && <div style={{ color: '#8b949e', fontSize: 14, padding: '20px 0' }}>Loading your repositories…</div>}

        <div style={list}>
          {filtered.map((r) => (
            <button key={r.fullName} style={row} onClick={() => onPick({ owner: r.owner, repo: r.name, branch: r.defaultBranch })}>
              <span style={{ fontWeight: 600, color: '#1f2328' }}>{r.fullName}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {r.private && <span style={badge}>private</span>}
                <span style={{ color: '#8b949e', fontSize: 12 }}>{r.defaultBranch}</span>
              </span>
            </button>
          ))}
          {repos && filtered.length === 0 && <div style={{ color: '#8b949e', fontSize: 14, padding: '16px 0' }}>No repositories match “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#f6f8fa,#eef1f5)', padding: 24 };
const panel: React.CSSProperties = { background: '#fff', border: '1px solid #d0d7de', borderRadius: 16, padding: 30, width: 'min(560px, 94vw)', boxShadow: '0 8px 30px rgba(31,35,40,.08)' };
const input: React.CSSProperties = { flex: 1, width: '100%', padding: '9px 12px', border: '1px solid #d0d7de', borderRadius: 8, fontSize: 14, color: '#1f2328' };
const goBtn: React.CSSProperties = { background: '#1f6feb', color: '#fff', border: 'none', padding: '0 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
const lastBtn: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', background: '#eef4ff', border: '1px solid #cfe0ff', color: '#1f4fb0', padding: '10px 12px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginBottom: 12 };
const initToggle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: '#f6f8fa', border: '1px solid #d0d7de', color: '#1f2328', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 10, fontSize: 14 };
const initPanel: React.CSSProperties = { border: '1px solid #d0d7de', borderRadius: 10, padding: 14, marginBottom: 12, background: '#fbfcfd' };
const segOn: React.CSSProperties = { flex: 1, padding: '7px 10px', border: '1px solid #1f6feb', background: '#1f6feb', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const segOff: React.CSSProperties = { flex: 1, padding: '7px 10px', border: '1px solid #d0d7de', background: '#fff', color: '#57606a', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const list: React.CSSProperties = { maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid #eaeef2', borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left' };
const badge: React.CSSProperties = { fontSize: 11, background: '#eaeef2', color: '#57606a', padding: '1px 6px', borderRadius: 20 };
