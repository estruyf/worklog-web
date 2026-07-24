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
    <div className="min-h-screen grid place-items-center p-6 bg-[linear-gradient(180deg,var(--color-neutral-200),var(--color-neutral-325))]">
      <div className="bg-white border border-neutral-400 rounded-2xl p-[30px] w-[min(560px,94vw)] shadow-[0_8px_30px_rgba(31,35,40,0.08)]">
        <div className="flex items-center gap-2 mb-[18px]">
          <img src="/worklog-logo-outline.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-bold text-[18px] text-neutral-825">Worklog</span>
        </div>
        <h1 className="m-0 mb-1 text-[24px] text-neutral-825">Choose a worklog repository</h1>
        <p className="m-0 mb-[18px] text-[14px] text-neutral-675">
          Pick the repo that holds your Worklog files (<code>.worklog/config.json</code>, <code>clients/</code>, <code>worklog/</code>, <code>archive/</code>).
        </p>

        {lastRepo && (
          <button
            className="block w-full text-left bg-brand-225 border border-brand-500 text-brand-800 px-3 py-[10px] rounded-lg font-semibold cursor-pointer mb-3"
            onClick={() => onPick(lastRepo)}
          >
            ↩ Reopen {lastRepo.owner}/{lastRepo.repo}
          </button>
        )}

        <form onSubmit={submitManual} className="flex gap-2 mt-1 mb-[14px]">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="owner/repo (or owner/repo@branch)"
            className={inputCls}
          />
          <button type="submit" className={goBtnCls}>Open</button>
        </form>

        <button
          type="button"
          className="flex justify-between items-center w-full bg-neutral-200 border border-neutral-400 text-neutral-825 px-3 py-[10px] rounded-lg cursor-pointer mb-[10px] text-[14px]"
          onClick={() => setShowInit((v) => !v)}
          aria-expanded={showInit}
        >
          <span className="font-semibold">＋ Initialize a new project</span>
          <span className="text-[18px] leading-none text-neutral-650">{showInit ? '−' : '+'}</span>
        </button>

        {showInit && (
          <form onSubmit={submitInit} className="border border-neutral-400 rounded-[10px] p-[14px] mb-3 bg-neutral-75">
            <p className="m-0 mb-[10px] text-[13px] text-neutral-675">
              Scaffold an empty Worklog project (<code>.worklog/config.json</code> plus <code>clients/</code>, <code>worklog/</code> and{' '}
              <code>archive/</code>) into a new or existing repository.
            </p>

            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setInitMode('create')} className={initMode === 'create' ? segOnCls : segOffCls}>
                New repository
              </button>
              <button type="button" onClick={() => setInitMode('existing')} className={initMode === 'existing' ? segOnCls : segOffCls}>
                Existing repository
              </button>
            </div>

            {initMode === 'create' ? (
              <>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="repository name (e.g. my-timesheet)"
                  className={`${inputCls} mb-[10px]`}
                  disabled={initBusy}
                />
                <label className="flex items-center gap-2 text-[13px] text-neutral-675 mb-3">
                  <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} disabled={initBusy} />
                  Private repository
                </label>
              </>
            ) : (
              <input
                value={existingRepo}
                onChange={(e) => setExistingRepo(e.target.value)}
                placeholder="owner/repo (or owner/repo@branch)"
                className={`${inputCls} mb-3`}
                disabled={initBusy}
              />
            )}

            {initError && <div className="text-[13px] text-danger-675 mb-[10px]">{initError}</div>}

            <button type="submit" className={`${goBtnCls} py-[9px] disabled:opacity-70`} disabled={initBusy}>
              {initBusy ? 'Initializing…' : 'Initialize & open'}
            </button>
          </form>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your repositories…"
          className={`${inputCls} mb-[10px]`}
        />

        {error && <div className="text-[13px] text-danger-675 mb-[10px]">{error}</div>}
        {!repos && !error && <div className="text-[14px] text-neutral-650 py-5">Loading your repositories…</div>}

        <div className="max-h-[360px] overflow-y-auto flex flex-col gap-[6px]">
          {filtered.map((r) => (
            <button
              key={r.fullName}
              className="flex justify-between items-center px-3 py-[10px] border border-neutral-400 rounded-lg bg-white cursor-pointer text-left"
              onClick={() => onPick({ owner: r.owner, repo: r.name, branch: r.defaultBranch })}
            >
              <span className="font-semibold text-neutral-825">{r.fullName}</span>
              <span className="flex items-center gap-2">
                {r.private && <span className="text-[11px] bg-neutral-250 text-neutral-700 px-[6px] py-px rounded-[20px]">private</span>}
                <span className="text-[12px] text-neutral-650">{r.defaultBranch}</span>
              </span>
            </button>
          ))}
          {repos && filtered.length === 0 && <div className="text-[14px] text-neutral-650 py-4">No repositories match “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}

// Shared class sets for the repeated form controls.
const inputCls = 'flex-1 w-full px-3 py-[9px] border border-neutral-525 rounded-lg text-[14px] text-neutral-825';
const goBtnCls = 'bg-brand-450 text-brand-800 border border-brand-500 px-4 rounded-lg font-semibold cursor-pointer';
const segOnCls = 'flex-1 px-[10px] py-[7px] border border-brand-500 bg-brand-225 text-brand-800 rounded-lg font-semibold text-[13px] cursor-pointer';
const segOffCls = 'flex-1 px-[10px] py-[7px] border border-neutral-525 bg-white text-neutral-700 rounded-lg font-semibold text-[13px] cursor-pointer';
