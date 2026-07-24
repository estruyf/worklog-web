import React, { useMemo } from 'react';
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
      <div className="shrink-0 border-b md:border-b-0 md:border-r border-[#E5E7EB] p-[14px] md:px-[14px] md:py-[18px] overflow-auto max-h-[38vh] md:max-h-none md:w-[260px]">
        {clients.map((c) => {
          const cnt = clientOpenCounts[c.id] ?? 0;
          const active = c.id === selectedClient;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedClient(c.id)}
              className={'flex items-center justify-between px-3 py-[9px] rounded-lg cursor-pointer mb-[3px] ' + (active ? 'bg-[#FBEFC0]' : 'bg-transparent hover:bg-[#F6F7F9]')}
            >
              <span className="flex items-center gap-[9px]">
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: colorOf(c.id) }} />
                <span className="font-semibold text-[14px]">{c.name}</span>
              </span>
              <span className="text-[#9AA0A6] text-[13px]">{cnt}</span>
            </div>
          );
        })}
        <button
          onClick={() => openClientEditor()}
          className="flex items-center gap-[6px] w-full mt-2 px-3 py-[9px] border border-dashed border-[#CDD3DA] rounded-lg bg-white text-[#57606A] text-[13px] cursor-pointer hover:border-[#E2BE2E] hover:text-[#3A2E05]"
        >
          <span className="text-[15px] leading-none">+</span> Add client
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 py-6 md:px-9 md:py-[30px]">
        <div className="flex items-center flex-wrap gap-[14px] mb-7">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: selectedColor }} />
          <h1 className="text-[24px] font-bold m-0">{selectedName}</h1>
          <span className="text-[14px] text-[#6E7781]">{selectedLastWorked}</span>
          {selectedClientObj && (
            <button
              onClick={() => openClientEditor(selectedClientObj)}
              title="Edit client"
              className="ml-1 flex items-center gap-[5px] px-[10px] py-[5px] border border-[#E5E7EB] rounded-md bg-white text-[#57606A] text-[12.5px] cursor-pointer hover:bg-[#F6F7F9]"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        <div className="text-[11px] font-bold tracking-[0.06em] text-[#6E7781] mb-[14px]">OPEN TASKS · {selectedOpenCount}</div>
        <div className="border border-[#ECEEF1] rounded-[14px] bg-white px-2 py-[6px] mb-[38px]">
          {selectedOpenRows.map((r) => <WorklogTaskRow key={r.id} row={r} />)}
          {selectedOpenCount === 0 && <div className="text-[14px] text-[#9AA0A6] italic py-2 px-2.5">No open tasks.</div>}
        </div>

        <div className="text-[11px] font-bold tracking-[0.06em] text-[#6E7781] mb-[14px]">RECENTLY COMPLETED</div>
        {selectedDone.length === 0 && <div className="text-[14px] text-[#9AA0A6] italic">Nothing archived yet for {selectedName || 'this client'}.</div>}
        {selectedDone.length > 0 && (
          <div className="border border-[#ECEEF1] rounded-[14px] bg-[#FCFCFD] px-2 py-[6px]">
            {selectedDone.map((t) => (
              <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-[#F4F5F7]">
                <span className="w-16 shrink-0 text-[10.5px] font-bold tracking-[0.05em] text-[#16A34A]">{statusMeta(t.status, true).label}</span>
                <span onClick={() => openDetail(t)} title="Open task" className="text-[14.5px] text-[#57606A] flex-1 line-through decoration-[#CDD3DA] cursor-pointer">
                  {t.title}
                </span>
                <span className="text-[13px] text-[#8A9099]">{t.completed ? fmtShort(t.completed) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
