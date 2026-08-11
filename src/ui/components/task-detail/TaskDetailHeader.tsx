import React from 'react';
import type { Task } from '../../../model/types';
import { CheckIcon } from 'lucide-react';
import { Button } from '../../primitives';
import { useData, useUi } from '../../context';
import { navigateBackToTask, navigateToView, useOpenedFromTaskId } from '../../router';
import { VIEW_LABELS } from '../../views/routes';
import { isDone, workedLabels, workedOnDate } from '../../utils';
import { WorkedToggle } from '../WorkedToggle';

export interface TaskDetailHeaderProps {
  task: Task;
  /** The task this one hangs off, when it is a subtask. It is where the way out
   *  leads — see below. */
  parent?: Task;
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
 *  behind you to go back to. What it names is where you came *from*: the parent
 *  task when you opened this subtask from it, and the view you were last on
 *  otherwise. A subtask opened from the parent is one you are working through a
 *  list of, and the rest of that list — not the day — is the next thing you want;
 *  the same subtask opened from the day, the search or a shared link has no such
 *  list behind it, and offering the parent there would be sending you somewhere
 *  you have never been.
 *
 *  Having a parent is therefore not the test — `useOpenedFromTaskId` is, and it is
 *  the journey the router recorded rather than anything about the task. (The rail
 *  links the parent unconditionally, which is where "take me to it" lives when you
 *  didn't come from there.)
 *
 *  It still names a destination rather than walking history: `navigateBackToTask`
 *  reuses the parent's entry, so working through subtask after subtask doesn't
 *  pile up a chain. Escape and the browser's own Back walk that chain, as before. */
export function TaskDetailHeader({ task, parent, isTodo }: TaskDetailHeaderProps) {
  const { reopen, toggleWorked, markDone, today } = useData();
  const { selectedDate, view } = useUi();
  const openedFrom = useOpenedFromTaskId();
  const backToParent = parent && openedFrom === parent.id ? parent : undefined;
  const done = isDone(task);
  const worked = !isTodo && workedOnDate(task, selectedDate);
  const workedText = workedLabels(worked, selectedDate, today);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      {backToParent ? (
        <Button size="xs" onClick={() => navigateBackToTask(backToParent.id)} title={`Back to “${backToParent.title}”`}>
          <span className="text-[15px] leading-none">‹</span>
          {/* Truncated rather than wrapped: a task title is as long as its author
              felt like, and the row has two actions to its right. */}
          <span className="min-w-0 max-w-[min(60vw,320px)] truncate">Back to {backToParent.title}</span>
        </Button>
      ) : (
        <Button size="xs" onClick={() => navigateToView(view)}>
          <span className="text-[15px] leading-none">‹</span> Back to {VIEW_LABELS[view]}
        </Button>
      )}
      <div className="flex flex-wrap gap-[8px]">
        {!isTodo && (
          <WorkedToggle
            variant="labeled"
            worked={worked}
            onToggle={() => toggleWorked(task)}
            title={workedText.title}
            label={workedText.action}
          />
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
