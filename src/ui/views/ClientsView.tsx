import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Client } from '../../model/types';
import type { WorklogRow } from '../model';
import { WorklogTaskRow } from '../components';
import { Button } from '../primitives';
import { useData, useUi } from '../context';
import { clientIdOf, fmtLong, fmtShort, isDone, renderMarkdown } from '../utils';

/** Derives the selected client's open rows, done list, counts and last-worked label. */
function useClientsData() {
  const { tasks, worklog, clients, allClients, archivedClients, today, colorOf, openRowsFor } = useData();
  const { selectedClient } = useUi();

  const openTasks = useMemo(() => tasks.filter((t) => !isDone(t)), [tasks]);
  // Selection resolves against every client: an archived one is still openable
  // from the archived list below, it just isn't offered by default.
  const selectedClientObj = useMemo(() => allClients.find((c) => c.id === selectedClient), [allClients, selectedClient]);
  const clientOpenCounts = useMemo(
    () => Object.fromEntries(allClients.map((c) => [c.id, openTasks.filter((t) => clientIdOf(t) === c.id).length])),
    [allClients, openTasks],
  );
  const scOpen = useMemo(() => tasks.filter((t) => clientIdOf(t) === selectedClient && !isDone(t)), [tasks, selectedClient]);
  const selectedOpenRows = useMemo<WorklogRow[]>(() => openRowsFor(scOpen), [openRowsFor, scOpen]);
  const selectedDone = useMemo(
    () => tasks.filter((t) => clientIdOf(t) === selectedClient && isDone(t)).sort((a, b) => (b.completed! > a.completed! ? 1 : -1)),
    [tasks, selectedClient],
  );
  const selectedLastWorked = useMemo(() => {
    const lastWorked = worklog
      .filter((w) => w.clientId === selectedClient)
      .map((w) => w.date)
      .sort()
      .pop();
    return lastWorked ? (lastWorked === today ? 'last worked today' : 'last worked ' + fmtLong(lastWorked)) : 'no time logged yet';
  }, [worklog, today, selectedClient]);

  return {
    clients,
    archivedClients,
    selectedColor: colorOf(selectedClient),
    selectedName: selectedClientObj?.name ?? '',
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    selectedOpenCount: scOpen.length,
    selectedDone,
    selectedLastWorked,
  };
}

/** Mobile-only client picker: a dropdown showing each client's colour dot,
 * name and open-task count. Replaces the sidebar list on narrow screens. */
function MobileClientDropdown({
  clients,
  archivedClients,
  selectedClient,
  selectedName,
  clientOpenCounts,
  colorOf,
  onSelect,
  onAdd,
}: {
  clients: Client[];
  archivedClients: Client[];
  selectedClient: string;
  selectedName: string;
  clientOpenCounts: Record<string, number>;
  colorOf: (id: string) => string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="md:hidden relative shrink-0 border-b border-neutral-400 p-[14px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-[11px] border border-neutral-525 rounded-[9px] bg-white cursor-pointer"
      >
        <span className="flex items-center gap-[9px] min-w-0">
          <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: colorOf(selectedClient) }} />
          <span className="font-semibold text-[15px] truncate">{selectedName || 'Select client'}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#57606A" strokeWidth="1.6" className={'shrink-0 transition-transform ' + (open ? 'rotate-180' : '')}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-[14px] right-[14px] top-[calc(100%-4px)] z-20 max-h-[50vh] overflow-auto border border-neutral-400 rounded-[10px] bg-white shadow-lg py-[6px]">
          {clients.map((c) => {
            const cnt = clientOpenCounts[c.id] ?? 0;
            const active = c.id === selectedClient;
            return (
              <div
                key={c.id}
                onClick={() => { onSelect(c.id); setOpen(false); }}
                className={'flex items-center justify-between px-3 py-[10px] mx-[6px] rounded-lg cursor-pointer ' + (active ? 'bg-brand-225' : 'hover:bg-neutral-200')}
              >
                <span className="flex items-center gap-[9px] min-w-0">
                  <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: colorOf(c.id) }} />
                  <span className="font-semibold text-[14px] truncate">{c.name}</span>
                </span>
                <span className="text-neutral-625 text-[13px]">{cnt}</span>
              </div>
            );
          })}
          {archivedClients.length > 0 && (
            <>
              <div className="mx-3 mt-[10px] mb-[6px] pt-[10px] border-t border-neutral-325 text-[10.5px] font-bold tracking-[0.06em] text-neutral-675">
                ARCHIVED · {archivedClients.length}
              </div>
              {archivedClients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => { onSelect(c.id); setOpen(false); }}
                  className={
                    'flex items-center justify-between px-3 py-[10px] mx-[6px] rounded-lg cursor-pointer ' +
                    (c.id === selectedClient ? 'bg-brand-225' : 'hover:bg-neutral-200')
                  }
                >
                  <span className="flex items-center gap-[9px] min-w-0 opacity-65">
                    <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: colorOf(c.id) }} />
                    <span className="font-semibold text-[14px] truncate">{c.name}</span>
                  </span>
                  <span className="text-neutral-625 text-[13px]">{clientOpenCounts[c.id] ?? 0}</span>
                </div>
              ))}
            </>
          )}
          <div
            onClick={() => { onAdd(); setOpen(false); }}
            className="flex items-center gap-[6px] mx-[6px] mt-[6px] px-3 py-[10px] border border-dashed border-neutral-550 rounded-lg text-neutral-700 text-[13px] cursor-pointer hover:border-brand-500 hover:text-brand-800"
          >
            <span className="text-[15px] leading-none">+</span> Add client
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientsView() {
  const { statusMeta, openDetail, openClientEditor, colorOf, setClientArchived } = useData();
  const { selectedClient, setSelectedClient, showArchivedClients, setShowArchivedClients } = useUi();
  const {
    clients,
    archivedClients,
    selectedColor,
    selectedName,
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    selectedOpenCount,
    selectedDone,
    selectedLastWorked,
  } = useClientsData();
  const clientDescription = selectedClientObj?.description?.trim() ?? '';
  const clientLinks = selectedClientObj?.links ?? [];
  const hasClientInfo = !!clientDescription || clientLinks.length > 0;
  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <MobileClientDropdown
        clients={clients}
        archivedClients={archivedClients}
        selectedClient={selectedClient}
        selectedName={selectedName}
        clientOpenCounts={clientOpenCounts}
        colorOf={colorOf}
        onSelect={setSelectedClient}
        onAdd={() => openClientEditor()}
      />
      <div className="hidden md:block shrink-0 md:border-r border-neutral-400 md:px-[14px] md:py-[18px] overflow-auto md:max-h-none md:w-[260px]">
        {clients.map((c) => {
          const cnt = clientOpenCounts[c.id] ?? 0;
          const active = c.id === selectedClient;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedClient(c.id)}
              className={'flex items-center justify-between px-3 py-[9px] rounded-lg cursor-pointer mb-[3px] ' + (active ? 'bg-brand-225' : 'bg-transparent hover:bg-neutral-200')}
            >
              <span className="flex items-center gap-[9px]">
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: colorOf(c.id) }} />
                <span className="font-semibold text-[14px]">{c.name}</span>
              </span>
              <span className="text-neutral-625 text-[13px]">{cnt}</span>
            </div>
          );
        })}
        <Button variant="dashed" size="md" onClick={() => openClientEditor()} className="w-full mt-2">
          <span className="text-[15px] leading-none">+</span> Add client
        </Button>

        {/* Retired clients, folded away — still openable, so their history and
            the Restore button stay one click from here. */}
        {archivedClients.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-325">
            <button
              onClick={() => setShowArchivedClients(!showArchivedClients)}
              className="flex items-center gap-[6px] w-full px-3 py-[6px] bg-transparent border-none text-[11px] font-bold tracking-[0.06em] text-neutral-675 cursor-pointer hover:text-neutral-825"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={'transition-transform ' + (showArchivedClients ? 'rotate-90' : '')}>
                <path d="M6 3l5 5-5 5" />
              </svg>
              ARCHIVED · {archivedClients.length}
            </button>
            {showArchivedClients &&
              archivedClients.map((c) => {
                const active = c.id === selectedClient;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClient(c.id)}
                    title={`${c.name} — archived`}
                    className={'flex items-center justify-between px-3 py-[9px] rounded-lg cursor-pointer mb-[3px] ' + (active ? 'bg-brand-225' : 'bg-transparent hover:bg-neutral-200')}
                  >
                    <span className="flex items-center gap-[9px] opacity-65">
                      <span className="w-[9px] h-[9px] rounded-full" style={{ background: colorOf(c.id) }} />
                      <span className="font-semibold text-[14px]">{c.name}</span>
                    </span>
                    <span className="text-neutral-625 text-[13px]">{clientOpenCounts[c.id] ?? 0}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto px-5 py-6 md:px-9 md:py-[30px]">
        <div className={'flex items-center flex-wrap gap-[14px] ' + (hasClientInfo ? 'mb-4' : 'mb-7')}>
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: selectedColor }} />
          <h1 className="text-[24px] font-bold m-0">{selectedName}</h1>
          {selectedClientObj?.archived && (
            <span title="Hidden from the pickers and lists; its history is untouched" className="text-[10.5px] font-bold tracking-[0.05em] text-neutral-675 bg-neutral-250 border border-neutral-400 rounded-full px-[9px] py-[3px]">
              ARCHIVED
            </span>
          )}
          <span className="text-[14px] text-neutral-675">{selectedLastWorked}</span>
          {selectedClientObj && (
            <Button size="xs" onClick={() => openClientEditor(selectedClientObj)} title="Edit client" className="ml-1">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" />
              </svg>
              Edit
            </Button>
          )}
          {selectedClientObj?.archived && (
            <Button size="xs" onClick={() => setClientArchived(selectedClientObj, false)} title="Bring this client back into the pickers and lists">
              Restore
            </Button>
          )}
        </div>

        {/* Who the client is and where their things live — the context you want
            in front of you before touching their tasks. */}
        {hasClientInfo && (
          <div className="border border-neutral-375 rounded-[14px] bg-white px-[18px] py-[14px] mb-7">
            {clientDescription && (
              <div
                className="wl-md text-[14px] leading-[1.6] text-neutral-825"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(clientDescription) }}
              />
            )}
            {clientLinks.length > 0 && (
              <div className={'flex flex-col gap-1 ' + (clientDescription ? 'mt-[14px] pt-[14px] border-t border-neutral-325' : '')}>
                {clientLinks.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-[7px] text-[13.5px] text-info hover:underline w-fit"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7.5 8.5" />
                    </svg>
                    {l.label || l.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-[14px]">OPEN TASKS · {selectedOpenCount}</div>
        <div className="border border-neutral-375 rounded-[14px] bg-white px-2 py-[6px] mb-[38px]">
          {selectedOpenRows.map((r) => <WorklogTaskRow key={r.id} row={r} />)}
          {selectedOpenCount === 0 && <div className="text-[14px] text-neutral-625 italic py-2 px-2.5">No open tasks.</div>}
        </div>

        <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-[14px]">RECENTLY COMPLETED</div>
        {selectedDone.length === 0 && <div className="text-[14px] text-neutral-625 italic">Nothing archived yet for {selectedName || 'this client'}.</div>}
        {selectedDone.length > 0 && (
          <div className="border border-neutral-375 rounded-[14px] bg-neutral-50 px-2 py-[6px]">
            {selectedDone.map((t) => (
              <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225">
                <span className="w-16 shrink-0 text-[10.5px] font-bold tracking-[0.05em] text-success-500">{statusMeta(t.status, true).label}</span>
                <span onClick={() => openDetail(t)} title="Open task" className="text-[14.5px] text-neutral-700 flex-1 line-through decoration-neutral-550 cursor-pointer">
                  {t.title}
                </span>
                <span className="text-[13px] text-neutral-650">{t.completed ? fmtShort(t.completed) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
