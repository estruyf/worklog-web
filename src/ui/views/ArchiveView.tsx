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
          <span className="text-[13px] text-neutral-675">
            {archivedTasksCount} task{archivedTasksCount === 1 ? '' : 's'}
          </span>
        </div>

        {groups.length === 0 && <div className="text-[14px] text-neutral-625 italic">No archived tasks yet.</div>}

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
      </div>
    </div>
  );
}
