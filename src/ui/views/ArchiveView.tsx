import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/icons';
import { useData } from '../context';
import { ARCHIVE_PAGE_SIZES, deriveArchive, fmtShort, pageWindow } from '../utils';
import type { ArchivePeriod } from '../utils';

const PERIODS: { key: ArchivePeriod; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'year', label: 'This year' },
];

/** Owns the Archive filter/pagination state and derives the page to render. */
function useArchiveData() {
  const { tasks, clientName, colorOf, today } = useData();
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState<ArchivePeriod>('all');
  const [pageSize, setPageSize] = useState(ARCHIVE_PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  // Any filter change re-orders the list, so paging starts over at the top.
  useEffect(() => {
    setPage(1);
  }, [query, clientId, period, pageSize]);

  const derived = useMemo(
    () => deriveArchive(tasks, { query, clientId, period, page, pageSize }, { clientName, colorOf, today }),
    [tasks, query, clientId, period, page, pageSize, clientName, colorOf, today],
  );

  const filtersActive = query !== '' || clientId !== '' || period !== 'all';
  const resetFilters = () => {
    setQuery('');
    setClientId('');
    setPeriod('all');
  };

  return {
    ...derived,
    query,
    setQuery,
    clientId,
    setClientId,
    period,
    setPeriod,
    pageSize,
    setPageSize,
    setPage,
    filtersActive,
    resetFilters,
  };
}

/** Search box + client/period filters for the archived tasks. */
function ArchiveFilterBar({
  query,
  setQuery,
  clientId,
  setClientId,
  period,
  setPeriod,
  clientCounts,
  filtersActive,
  resetFilters,
}: {
  query: string;
  setQuery: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  period: ArchivePeriod;
  setPeriod: (v: ArchivePeriod) => void;
  clientCounts: Record<string, number>;
  filtersActive: boolean;
  resetFilters: () => void;
}) {
  const { clients } = useData();
  const allCount = clients.reduce((n, c) => n + (clientCounts[c.id] ?? 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <div className="flex items-center gap-[10px] flex-1 min-w-[220px] px-[12px] py-[8px] border border-neutral-525 rounded-[9px] bg-white focus-within:border-brand-500">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#8A9099" strokeWidth="1.5" className="shrink-0">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-[16px] md:text-[14px] text-input-fg outline-none focus-visible:outline-none!"
          placeholder="Filter by title, tag, link..."
        />
        {query && (
          <button className="text-muted hover:text-fg cursor-pointer shrink-0" onClick={() => setQuery('')} aria-label="Clear filter">
            <Icon name="close" />
          </button>
        )}
      </div>

      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        aria-label="Filter by client"
        className="px-3 py-[8px] border border-neutral-525 rounded-[9px] text-[14px] bg-white cursor-pointer focus:outline-none focus:border-brand-500"
      >
        <option value="">All clients ({allCount})</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({clientCounts[c.id] ?? 0})
          </option>
        ))}
      </select>

      <div className="inline-flex p-[2px] rounded-[8px] bg-neutral-250 border border-neutral-400">
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={
                'px-[11px] py-[5px] rounded-[6px] text-[12.5px] cursor-pointer ' +
                (active ? 'bg-white text-neutral-825 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-neutral-675 font-medium')
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {filtersActive && (
        <button onClick={resetFilters} className="text-[12.5px] text-info bg-none border-none cursor-pointer px-1">
          Reset
        </button>
      )}
    </div>
  );
}

/** Page stepper with an elided page-number window, plus the page-size picker. */
function ArchivePager({
  page,
  pageCount,
  pageSize,
  setPage,
  setPageSize,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  setPage: (v: number) => void;
  setPageSize: (v: number) => void;
}) {
  const btn = 'min-w-[32px] h-8 px-[9px] border rounded-[7px] bg-white text-[13px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
      <div className="flex items-center gap-[5px]">
        <button onClick={() => setPage(page - 1)} disabled={page <= 1} className={btn + ' border-neutral-400 text-neutral-750 hover:bg-neutral-200'} aria-label="Previous page">
          ‹
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-[13px] text-neutral-625">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={btn + (p === page ? ' border-brand-500 bg-brand-225 text-brand-650' : ' border-neutral-400 text-neutral-750 hover:bg-neutral-200')}
            >
              {p}
            </button>
          ),
        )}
        <button onClick={() => setPage(page + 1)} disabled={page >= pageCount} className={btn + ' border-neutral-400 text-neutral-750 hover:bg-neutral-200'} aria-label="Next page">
          ›
        </button>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-neutral-675">
        Per page
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="px-2 py-[5px] border border-neutral-525 rounded-[7px] text-[13px] bg-white cursor-pointer focus:outline-none focus:border-brand-500"
        >
          {ARCHIVE_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function ArchiveView() {
  const { statusMeta, openDetail, reopen, deleteTask } = useData();
  const {
    totalCount,
    filteredCount,
    page,
    pageCount,
    from,
    to,
    groups,
    clientCounts,
    query,
    setQuery,
    clientId,
    setClientId,
    period,
    setPeriod,
    pageSize,
    setPageSize,
    setPage,
    filtersActive,
    resetFilters,
  } = useArchiveData();
  const deleteForever = (id: string) => deleteTask(id, { permanent: true });
  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-[24px] font-bold m-0">Archive</h1>
          <span className="text-[13px] text-neutral-675">
            {filteredCount === 0
              ? `${totalCount} task${totalCount === 1 ? '' : 's'}`
              : `${from}–${to} of ${filteredCount}${filteredCount === totalCount ? '' : ` (of ${totalCount})`}`}
          </span>
        </div>

        {totalCount > 0 && (
          <ArchiveFilterBar
            query={query}
            setQuery={setQuery}
            clientId={clientId}
            setClientId={setClientId}
            period={period}
            setPeriod={setPeriod}
            clientCounts={clientCounts}
            filtersActive={filtersActive}
            resetFilters={resetFilters}
          />
        )}

        {totalCount === 0 && <div className="text-[14px] text-neutral-625 italic">No archived tasks yet.</div>}

        {totalCount > 0 && filteredCount === 0 && (
          <div className="text-[14px] text-neutral-625 italic">
            No archived tasks match these filters.{' '}
            <button onClick={resetFilters} className="text-info bg-none border-none cursor-pointer p-0 italic underline">
              Reset
            </button>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.id} className="border border-neutral-375 rounded-[14px] bg-neutral-50 mb-[14px] overflow-hidden">
            <div className="flex items-center gap-[9px] px-[18px] py-[13px] bg-neutral-175 border-b border-neutral-375 whitespace-nowrap">
              <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: g.color }} />
              <span className="font-bold text-[14.5px]">{g.name}</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-neutral-325 text-neutral-675 text-[12px] font-semibold">{g.count}</span>
            </div>

            <div className="px-2 py-[6px]">
              {g.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225">
                  <span className="w-16 shrink-0 text-[10.5px] font-bold tracking-[0.05em] text-success-500">{statusMeta(t.status, true).label}</span>
                  <button onClick={() => openDetail(t)} title="Open task" className="text-[14.5px] text-neutral-700 flex-1 text-left line-through decoration-neutral-550 bg-transparent border-none cursor-pointer hover:underline p-0">
                    {t.title}
                  </button>
                  <span className="text-[13px] text-neutral-650">{t.completed ? fmtShort(t.completed) : ''}</span>
                  <button onClick={() => reopen(t)} className="px-[10px] py-[6px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 font-semibold text-[12px] cursor-pointer hover:bg-neutral-200">
                    Restore
                  </button>
                  <button onClick={() => deleteForever(t.id)} className="px-[10px] py-[6px] border border-danger-225 rounded-[7px] bg-white text-danger-675 font-semibold text-[12px] cursor-pointer hover:bg-danger-75">
                    Delete forever
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {pageCount > 1 && <ArchivePager page={page} pageCount={pageCount} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />}
      </div>
    </div>
  );
}
