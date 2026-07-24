import React, { useMemo } from 'react';
import type { ArchiveGroup } from '../model';
import { useData } from '../context';
import { clientIdOf, fmtShort, isDone } from '../utils';

/** Derives the archived tasks grouped by client for the Archive view. */
function useArchiveData() {
  const { tasks, clients, colorOf } = useData();
  const archivedTasks = useMemo(
    () =>
      tasks
        .filter((t) => isDone(t))
        .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? '') || a.title.localeCompare(b.title)),
    [tasks],
  );
  const groups = useMemo<ArchiveGroup[]>(
    () =>
      clients
        .map((c) => {
          const ct = archivedTasks.filter((t) => clientIdOf(t) === c.id);
          return { id: c.id, name: c.name, color: colorOf(c.id), count: ct.length, tasks: ct };
        })
        .filter((g) => g.count > 0),
    [clients, archivedTasks, colorOf],
  );
  return { archivedTasksCount: archivedTasks.length, groups };
}

export function ArchiveView() {
  const { statusMeta, openDetail, reopen, deleteTask } = useData();
  const { archivedTasksCount, groups } = useArchiveData();
  const deleteForever = (id: string) => deleteTask(id, { permanent: true });
  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[24px] font-bold m-0">Archive</h1>
          <span className="text-[13px] text-[#6E7781]">
            {archivedTasksCount} task{archivedTasksCount === 1 ? '' : 's'}
          </span>
        </div>

        {groups.length === 0 && <div className="text-[14px] text-[#9AA0A6] italic">No archived tasks yet.</div>}

        {groups.map((g) => (
          <div key={g.id} className="border border-[#ECEEF1] rounded-[14px] bg-[#FCFCFD] mb-[14px] overflow-hidden">
            <div className="flex items-center gap-[9px] px-[18px] py-[13px] bg-[#F7F8FA] border-b border-[#ECEEF1] whitespace-nowrap">
              <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: g.color }} />
              <span className="font-bold text-[14.5px]">{g.name}</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-[#EEF0F2] text-[#6E7781] text-[12px] font-semibold">{g.count}</span>
            </div>

            <div className="px-2 py-[6px]">
              {g.tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-[#F4F5F7]">
                  <span className="w-16 shrink-0 text-[10.5px] font-bold tracking-[0.05em] text-[#16A34A]">{statusMeta(t.status, true).label}</span>
                  <button onClick={() => openDetail(t)} title="Open task" className="text-[14.5px] text-[#57606A] flex-1 text-left line-through decoration-[#CDD3DA] bg-transparent border-none cursor-pointer hover:underline p-0">
                    {t.title}
                  </button>
                  <span className="text-[13px] text-[#8A9099]">{t.completed ? fmtShort(t.completed) : ''}</span>
                  <button onClick={() => reopen(t)} className="px-[10px] py-[6px] border border-[#E5E7EB] rounded-[7px] bg-white text-[#3C4149] font-semibold text-[12px] cursor-pointer hover:bg-[#F6F7F9]">
                    Restore
                  </button>
                  <button onClick={() => deleteForever(t.id)} className="px-[10px] py-[6px] border border-[#F0C9C9] rounded-[7px] bg-white text-[#DC2626] font-semibold text-[12px] cursor-pointer hover:bg-[#FEF2F2]">
                    Delete forever
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
