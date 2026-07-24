import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Client } from '../../model/types';
import type { WorklogRow } from '../model';
import { WorklogTaskRow } from '../components';
import { useData, useUi } from '../context';
import { clientIdOf, fmtLong, fmtShort, isDone } from '../utils';

/** Derives the selected client's open rows, done list, counts and last-worked label. */
function useClientsData() {
  const { tasks, worklog, clients, today, colorOf, openRowsFor } = useData();
  const { selectedClient } = useUi();

  const openTasks = useMemo(() => tasks.filter((t) => !isDone(t)), [tasks]);
  const selectedClientObj = useMemo(() => clients.find((c) => c.id === selectedClient), [clients, selectedClient]);
  const clientOpenCounts = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, openTasks.filter((t) => clientIdOf(t) === c.id).length])),
    [clients, openTasks],
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
  selectedClient,
  selectedName,
  clientOpenCounts,
  colorOf,
  onSelect,
  onAdd,
}: {
  clients: Client[];
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
  const { statusMeta, openDetail, openClientEditor, colorOf } = useData();
  const { selectedClient, setSelectedClient } = useUi();
  const {
    clients,
    selectedColor,
    selectedName,
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    selectedOpenCount,
    selectedDone,
    selectedLastWorked,
  } = useClientsData();
  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <MobileClientDropdown
        clients={clients}
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
        <button
          onClick={() => openClientEditor()}
          className="flex items-center gap-[6px] w-full mt-2 px-3 py-[9px] border border-dashed border-neutral-550 rounded-lg bg-white text-neutral-700 text-[13px] cursor-pointer hover:border-brand-500 hover:text-brand-800"
        >
          <span className="text-[15px] leading-none">+</span> Add client
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 py-6 md:px-9 md:py-[30px]">
        <div className="flex items-center flex-wrap gap-[14px] mb-7">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: selectedColor }} />
          <h1 className="text-[24px] font-bold m-0">{selectedName}</h1>
          <span className="text-[14px] text-neutral-675">{selectedLastWorked}</span>
          {selectedClientObj && (
            <button
              onClick={() => openClientEditor(selectedClientObj)}
              title="Edit client"
              className="ml-1 flex items-center gap-[5px] px-[10px] py-[5px] border border-neutral-400 rounded-md bg-white text-neutral-700 text-[12.5px] cursor-pointer hover:bg-neutral-200"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>

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
