// The full general to-do list: every task in the reserved to-do bucket, open and
// completed alike. The Day view only surfaces the open ones (as a side list next
// to that day's work); this view is the place to see and manage them all.

import React, { useMemo, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { GENERAL_TODO_COLOR, GENERAL_TODO_LABEL, isGeneralTodoClientId } from '../../model/todos';
import type { Task } from '../../model/types';
import { CompletedTaskRow, DisclosureIcon, TaskListToolbar, WorklogTaskRow } from '../components';
import { Button, Card, EmptyState, LinkButton, SectionLabel } from '../primitives';
import { useData } from '../context';
import { useTaskListFilter } from '../hooks';
import { clientIdOf, fmtShort, isDone } from '../utils';

/** Splits the to-do bucket into open rows and completed tasks (newest first).
 *  The open list is filtered/sorted first, so the rows are built from what the
 *  toolbar actually left — subtasks included, since they nest per parent. */
function useTodosData() {
  const { tasks, openRowsFor } = useData();
  const todos = useMemo(() => tasks.filter((t) => isGeneralTodoClientId(clientIdOf(t))), [tasks]);
  const openTasks = useMemo(() => todos.filter((t) => !isDone(t)), [todos]);
  // A to-do's status is open-or-closed, so a status filter would say nothing.
  const filter = useTaskListFilter(openTasks, { label: 'to-dos', withStatus: false });
  const openRows = useMemo(() => openRowsFor(filter.tasks), [filter.tasks, openRowsFor]);
  const doneTasks = useMemo(
    () =>
      todos
        .filter(isDone)
        .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? '') || a.title.localeCompare(b.title)),
    [todos],
  );
  return { openRows, openCount: openTasks.length, doneTasks, filter };
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
            <CompletedTaskRow
              key={t.id}
              task={t}
              onOpen={() => openDetail(t)}
              onReopen={() => reopen(t)}
              meta={t.completed ? fmtShort(t.completed) : ''}
              showLink
            />
          ))}
        </Card>
      )}
    </>
  );
}

export function TodosView() {
  const { openTodoForm } = useData();
  const { openRows, openCount, doneTasks, filter } = useTodosData();

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
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
          <>
            {filter.toolbar && <TaskListToolbar {...filter.toolbar} />}
            {openRows.length === 0 ? (
              <EmptyState>
                No to-dos match these filters.{' '}
                <LinkButton size="inherit" onClick={filter.reset} className="italic underline">
                  Reset
                </LinkButton>
              </EmptyState>
            ) : (
              <Card padding="list">
                {openRows.map((row) => (
                  <WorklogTaskRow key={row.id} row={row} />
                ))}
              </Card>
            )}
          </>
        )}

        <CompletedTodos doneTasks={doneTasks} />
      </div>
    </div>
  );
}
