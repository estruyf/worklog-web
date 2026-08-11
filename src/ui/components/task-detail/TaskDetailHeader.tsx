import React from 'react';
import type { Task } from '../../../model/types';
import { BriefcaseIcon, CheckIcon } from 'lucide-react';
import { Button } from '../../primitives';
import { useData, useUi } from '../../context';
import { navigateToView } from '../../router';
import { VIEW_LABELS } from '../../views/routes';
import { isDone, workedOnDate } from '../../utils';

export interface TaskDetailHeaderProps {
  task: Task;
  /** General to-dos are open or closed only — no worked-on marking. */
  isTodo: boolean;
}

/** The way out on the left; on the right, the two actions that are the point of
 *  opening a task at all — did I work on this today, and is it done. Everything
 *  else you can do to it is a row in the rail's actions list, so this row stays
 *  two buttons wide however many actions the task grows.
 *
 *  The way out names where it goes rather than saying "Back", because a task is a
 *  URL now and you can arrive at one from outside the app, where there is nothing
 *  behind you to go back to. It goes to the view you were last on, which is what
 *  leaving a task has always meant; a shared link starts on the Day view and lands
 *  there. It deliberately does not walk back through history — Back off a subtask
 *  lands on its parent task, and a button reading "Back to Day" must not do that.
 *  (Escape still walks the chain, the same as the browser's own Back.) */
export function TaskDetailHeader({ task, isTodo }: TaskDetailHeaderProps) {
  const { reopen, toggleWorked, markDone } = useData();
  const { selectedDate, view } = useUi();
  const done = isDone(task);
  const worked = !isTodo && workedOnDate(task, selectedDate);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <Button size="xs" onClick={() => navigateToView(view)}>
        <span className="text-[15px] leading-none">‹</span> Back to {VIEW_LABELS[view]}
      </Button>
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
      </div>
    </div>
  );
}
