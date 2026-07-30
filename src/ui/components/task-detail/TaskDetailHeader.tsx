import React from 'react';
import type { Task } from '../../../model/types';
import { BriefcaseIcon, CheckIcon } from 'lucide-react';
import { Button, LinkButton } from '../../primitives';
import { useData, useUi } from '../../context';
import { navigateToDashboard } from '../../router';
import { isDone, workedOnDate } from '../../utils';

export interface TaskDetailHeaderProps {
  task: Task;
  parent?: Task;
  /** The /app/task/<id> page, which has a breadcrumb instead of a Back button. */
  routed: boolean;
  /** General to-dos are open or closed only — no worked-on marking. */
  isTodo: boolean;
  onBack: () => void;
  onOpenTask: (id: string) => void;
}

/** Where you came from on the left, what you can do to the task on the right. */
export function TaskDetailHeader({ task, parent, routed, isTodo, onBack, onOpenTask }: TaskDetailHeaderProps) {
  const { reopen, toggleWorked, markDone, openEdit, deleteTask, openSubtaskForm } = useData();
  const { selectedDate } = useUi();
  const done = isDone(task);
  const worked = !isTodo && workedOnDate(task, selectedDate);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      {routed ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-control text-neutral-700 min-w-0">
          <LinkButton size="inherit" onClick={navigateToDashboard}>
            Worklog
          </LinkButton>
          {parent && (
            <>
              <span className="text-neutral-600">/</span>
              <LinkButton size="inherit" onClick={() => onOpenTask(parent.id)} className="truncate max-w-[220px]">
                {parent.title}
              </LinkButton>
            </>
          )}
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-825 font-medium truncate max-w-[280px]">{task.title}</span>
        </nav>
      ) : (
        <Button size="xs" onClick={onBack}>
          <span className="text-[15px] leading-none">‹</span> Back
        </Button>
      )}
      <div className="flex flex-wrap gap-[8px]">
        {!isTodo && (
          <button
            onClick={() => toggleWorked(task)}
            title={worked ? 'Unmark worked on this day' : 'Mark worked on this day'}
            className={
              'flex items-center gap-[6px] px-[14px] py-[7px] border rounded-control font-semibold text-control cursor-pointer ' +
              (worked
                ? 'border-brand-500 bg-brand-225 text-brand-650 hover:bg-brand-275'
                : 'border-brand-400 bg-brand-100 text-brand-625 hover:bg-brand-200')
            }
          >
            <BriefcaseIcon className="w-[13px] h-[13px]" />
            {worked ? 'Worked marked' : 'Mark worked'}
          </button>
        )}
        {done ? (
          <Button onClick={() => reopen(task)}>Reopen</Button>
        ) : (
          <Button variant="success" onClick={() => markDone(task)} title="Completes this task and all its subtasks">
            <CheckIcon size={13} strokeWidth={2.2} />
            Mark done
          </Button>
        )}
        <Button onClick={() => openEdit(task)}>Edit details</Button>
        {!done && <Button onClick={() => openSubtaskForm(task)}>Add subtask</Button>}
        <Button variant="danger" onClick={() => deleteTask(task.id, { permanent: done })}>
          {done ? 'Delete forever' : 'Delete'}
        </Button>
      </div>
    </div>
  );
}
