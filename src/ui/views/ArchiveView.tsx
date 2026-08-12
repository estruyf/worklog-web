import React, { useEffect, useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, LinkButton, Pager, SegmentedControl, Select, ViewHeader } from '../primitives';
import { CompletedTaskRow } from '../components';
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
  // The archive is history: an archived client's closed tasks are still in here,
  // so the picker has to offer every client, not just the active ones.
  const { allClients } = useData();
  const allCount = allClients.reduce((n, c) => n + (clientCounts[c.id] ?? 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        clearable
        onClear={() => setQuery('')}
        clearLabel="Clear filter"
        leading={<SearchIcon size={15} className="shrink-0 text-neutral-650" />}
        aria-label="Filter archived tasks"
        placeholder="Filter by title, tag, link..."
        className="basis-full min-w-[220px] sm:basis-auto sm:flex-1"
        inputClassName="text-input-fg"
      />

      {/* Same as the task-list toolbar: the query owns the first row on a phone
          so the client picker isn't left sharing one at whatever width its
          longest client name asks for. */}
      <Select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        aria-label="Filter by client"
        className="flex-1 min-w-0 sm:flex-none"
      >
        <option value="">All clients ({allCount})</option>
        {allClients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({clientCounts[c.id] ?? 0})
          </option>
        ))}
      </Select>

      <SegmentedControl
        aria-label="Filter by period"
        options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
        value={period}
        onChange={setPeriod}
      />

      {filtersActive && (
        <LinkButton onClick={resetFilters} className="px-1">
          Reset
        </LinkButton>
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
      <Pager page={page} pageCount={pageCount} onPage={setPage} pages={pageWindow(page, pageCount)} />
      <label className="flex items-center gap-2 text-chip text-neutral-675">
        Per page
        <Select size="xs" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          {ARCHIVE_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
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
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold m-0">Archive</h1>
        <span className="text-control text-neutral-675">
          {filteredCount === 0
            ? `${totalCount} task${totalCount === 1 ? '' : 's'}`
            : `${from}–${to} of ${filteredCount}${filteredCount === totalCount ? '' : ` (of ${totalCount})`}`}
        </span>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
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

          {totalCount === 0 && <EmptyState>No archived tasks yet.</EmptyState>}

          {totalCount > 0 && filteredCount === 0 && (
            <EmptyState>
              No archived tasks match these filters.{' '}
              <LinkButton size="inherit" onClick={resetFilters} className="italic underline">
                Reset
              </LinkButton>
            </EmptyState>
          )}

          {groups.map((g) => (
            <Card key={g.id} tone="muted" className="mb-[14px] overflow-hidden">
              <div className="flex items-center gap-[9px] px-[18px] py-[13px] bg-neutral-175 border-b border-neutral-375 whitespace-nowrap">
                <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: g.color }} />
                <span className="font-bold text-row">{g.name}</span>
                <Badge>{g.count}</Badge>
              </div>

              <div className="px-2 py-[6px]">
                {g.tasks.map((t) => (
                  <CompletedTaskRow
                    key={t.id}
                    task={t}
                    onOpen={() => openDetail(t)}
                    status={statusMeta(t.status, true).label}
                    statusColor={statusMeta(t.status, true).color}
                    meta={t.completed ? fmtShort(t.completed) : ''}
                    actions={
                      <>
                        <Button size="xs" onClick={() => reopen(t)}>
                          Restore
                        </Button>
                        <Button size="xs" variant="danger" onClick={() => deleteForever(t.id)}>
                          Delete forever
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </Card>
          ))}

          {pageCount > 1 && <ArchivePager page={page} pageCount={pageCount} pageSize={pageSize} setPage={setPage} setPageSize={setPageSize} />}
        </div>
      </div>
    </div>
  );
}
