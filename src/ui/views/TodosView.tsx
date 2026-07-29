// The full general to-do list: every task in the reserved to-do bucket, open and
// completed alike. The Day view only surfaces the open ones (as a side list next
// to that day's work); this view is the place to see and manage them all.

import React, { useMemo, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { GENERAL_TODO_COLOR, GENERAL_TODO_LABEL, isGeneralTodoClientId } from '../../model/todos';
import type { Task } from '../../model/types';
import { WorklogTaskRow } from '../components';
import { useData } from '../context';
import { clientIdOf, fmtShort, isDone, linksOf } from '../utils';

/** Splits the to-do bucket into open rows and completed tasks (newest first). */
function useTodosData() {
  const { tasks, openRowsFor } = useData();
  const todos = useMemo(() => tasks.filter((t) => isGeneralTodoClientId(clientIdOf(t))), [tasks]);
  const openTasks = useMemo(() => todos.filter((t) => !isDone(t)), [todos]);
  const openRows = useMemo(() => openRowsFor(openTasks), [openTasks, openRowsFor]);
  const doneTasks = useMemo(
    () =>
      todos
        .filter(isDone)
        .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? '') || a.title.localeCompare(b.title)),
    [todos],
  );
  return { openRows, openCount: openTasks.length, doneTasks };
}

/** Completed to-dos, collapsed by default so the open list stays the focus. */
function CompletedTodos({ doneTasks }: { doneTasks: Task[] }) {
  const { openDetail, reopen } = useData();
  const [open, setOpen] = useState(false);

  if (doneTasks.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mt-9 mb-[14px] bg-transparent border-none p-0 cursor-pointer text-[11px] font-bold tracking-[0.06em] text-neutral-675 hover:text-neutral-825"
      >
        <span className={'transition-transform ' + (open ? 'rotate-90' : '')}>›</span>
        COMPLETED ({doneTasks.length})
      </button>

      {open && (
        <div className="border border-neutral-375 rounded-[14px] bg-neutral-50 px-2 py-[6px]">
          {doneTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225">
              <button
                onClick={() => reopen(t)}
                title="Reopen"
                className="w-[17px] h-[17px] shrink-0 border-none rounded-full bg-success-500 cursor-pointer p-0 flex items-center justify-center"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.5">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              </button>
              <span
                onClick={() => openDetail(t)}
                title="Open task"
                className="text-[14.5px] text-neutral-700 flex-1 line-through decoration-neutral-550 cursor-pointer"
              >
                {t.title}
              </span>
              <span className="text-[13px] text-neutral-650">{t.completed ? fmtShort(t.completed) : ''}</span>
              {linksOf(t).length > 0 && (
                <a
                  href={linksOf(t)[0]}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-neutral-625 leading-[0] hover:text-info"
                  title={linksOf(t)[0]}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7.5 8.5" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function TodosView() {
  const { openTodoForm } = useData();
  const { openRows, openCount, doneTasks } = useTodosData();

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-[10px]">
            <span className="w-[10px] h-[10px] rounded-full shrink-0" style={{ background: GENERAL_TODO_COLOR }} />
            <h1 className="text-[24px] font-bold m-0">{GENERAL_TODO_LABEL}</h1>
            <span className="text-[13px] text-neutral-675">
              {openCount} open{doneTasks.length > 0 ? ` · ${doneTasks.length} completed` : ''}
            </span>
          </div>
          <button
            onClick={openTodoForm}
            className="flex items-center gap-[7px] px-[14px] py-[8px] rounded-[8px] text-[13px] font-semibold cursor-pointer border border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475"
          >
            <PlusIcon size={15} />
            New to-do
          </button>
        </div>

        {openCount === 0 ? (
          <div className="text-[14px] text-neutral-625 italic">
            No open to-dos. These are the tasks that aren&apos;t linked to a client.
          </div>
        ) : (
          <div className="border border-neutral-375 rounded-[14px] bg-white px-2 py-[6px]">
            {openRows.map((row) => (
              <WorklogTaskRow key={row.id} row={row} />
            ))}
          </div>
        )}

        <CompletedTodos doneTasks={doneTasks} />
      </div>
    </div>
  );
}
