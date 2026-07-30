import React from 'react';
import type { Task } from '../../../model/types';
import { DateInput, LinkButton } from '../../primitives';
import { useUi } from '../../context';
import { isDone } from '../../utils';
import { daysOverdue, formatDaysLate, isOverdue } from '../../../model/overdue';
import { worklogStore } from '../../../data/worklogStore';

/** The task's one editable date — its due date while open, the day it was closed
 *  once done.
 *
 *  A recurring task has neither: its due date is the series' next occurrence and
 *  is managed by the rule, so editing it by hand would fight the roll forward.
 *  `RepeatSummary` states it instead, and this renders nothing. */
export function DueEditor({ task }: { task: Task }) {
  const { selectedDate } = useUi();
  const setDue = (date: string) => worklogStore.updateTask(task.id, { due: date });

  if (isDone(task)) {
    return (
      <div className="flex items-center gap-[10px] mb-4 text-control text-neutral-700">
        <span className="font-semibold">Completed on</span>
        <DateInput
          size="sm"
          value={task.completed ?? ''}
          onChange={(e) => {
            const nextDate = e.target.value;
            if (nextDate) {
              worklogStore.setCompletedDate(task.id, nextDate);
            }
          }}
          aria-label="Completion date"
        />
      </div>
    );
  }

  if (task.repeat) {
    return null;
  }

  const overdue = isOverdue(task, selectedDate);
  return (
    <div className="flex items-center gap-[10px] mb-4 text-control text-neutral-700">
      <span className={'font-semibold ' + (overdue ? 'text-danger-675' : '')}>{overdue ? 'Overdue · due' : 'Due'}</span>
      {/* Overdue is a validation state, not a colour choice — `invalid`
          is what paints the border and the text red. */}
      <DateInput size="sm" invalid={overdue} value={task.due ?? ''} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
      {overdue && <span className="text-chip text-danger-675">{formatDaysLate(daysOverdue(task, selectedDate))}</span>}
      {task.due && (
        <LinkButton size="xs" onClick={() => setDue('')}>
          Clear
        </LinkButton>
      )}
    </div>
  );
}
