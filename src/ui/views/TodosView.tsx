// The full general to-do list: every task in the reserved to-do bucket, open and
// completed alike. The Day view only surfaces the open ones (as a side list next
// to that day's work); this view is the place to see and manage them all.

import React, { useMemo, useState } from 'react';
import { CheckIcon, ExternalLinkIcon, PlusIcon } from 'lucide-react';
import { GENERAL_TODO_COLOR, GENERAL_TODO_LABEL, isGeneralTodoClientId } from '../../model/todos';
import type { Task } from '../../model/types';
import { DisclosureIcon, WorklogTaskRow } from '../components';
import { Button, Card, EmptyState, SectionLabel } from '../primitives';
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
        className="group flex items-center gap-2 mt-9 mb-[14px] bg-transparent border-none p-0 cursor-pointer text-neutral-675"
      >
        <DisclosureIcon open={open} size={10} />
        <SectionLabel className="group-hover:text-neutral-825">Completed ({doneTasks.length})</SectionLabel>
      </button>

      {open && (
        <Card tone="muted" padding="list">
          {doneTasks.map((t) => (
            <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225">
              <button
                onClick={() => reopen(t)}
                title="Reopen"
                className="w-[17px] h-[17px] shrink-0 border-none rounded-full bg-success-500 text-white cursor-pointer p-0 flex items-center justify-center"
              >
                <CheckIcon size={11} strokeWidth={2.5} />
              </button>
              <span
                onClick={() => openDetail(t)}
                title="Open task"
                className="text-row text-neutral-700 flex-1 line-through decoration-neutral-550 cursor-pointer"
              >
                {t.title}
              </span>
              <span className="text-control text-neutral-650">{t.completed ? fmtShort(t.completed) : ''}</span>
              {linksOf(t).length > 0 && (
                <a
                  href={linksOf(t)[0]}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-neutral-625 leading-[0] hover:text-info"
                  title={linksOf(t)[0]}
                >
                  <ExternalLinkIcon size={14} />
                </a>
              )}
            </div>
          ))}
        </Card>
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
            <span className="text-control text-neutral-675">
              {openCount} open{doneTasks.length > 0 ? ` · ${doneTasks.length} completed` : ''}
            </span>
          </div>
          <Button variant="primary" size="md" onClick={openTodoForm}>
            <PlusIcon size={15} />
            New to-do
          </Button>
        </div>

        {openCount === 0 ? (
          <EmptyState>No open to-dos. These are the tasks that aren&apos;t linked to a client.</EmptyState>
        ) : (
          <Card padding="list">
            {openRows.map((row) => (
              <WorklogTaskRow key={row.id} row={row} />
            ))}
          </Card>
        )}

        <CompletedTodos doneTasks={doneTasks} />
      </div>
    </div>
  );
}
