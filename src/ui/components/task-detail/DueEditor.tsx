import React from 'react';
import type { Task } from '../../../model/types';
import { DateInput, LinkButton, SidebarSection } from '../../primitives';
import { useUi } from '../../context';
import { isDone } from '../../utils';
import { daysOverdue, formatDaysLate, isOverdue } from '../../../model/overdue';
import { worklogStore } from '../../../data/worklogStore';

/** The task's one editable date — its due date while open, the day it was closed
 *  once done — as a block in the detail panel's rail.
 *
 *  A recurring task has neither: its due date is the series' next occurrence and
 *  is managed by the rule, so editing it by hand would fight the roll forward.
 *  `RepeatSummary` states it instead, and this renders nothing. */
export function DueEditor({ task }: { task: Task }) {
  const { selectedDate } = useUi();
  const setDue = (date: string) => worklogStore.updateTask(task.id, { due: date });

  if (isDone(task)) {
    return (
      <SidebarSection title="Completed on">
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
          className="w-full"
        />
      </SidebarSection>
    );
  }

  if (task.repeat) {
    return null;
  }

  const overdue = isOverdue(task, selectedDate);
  return (
    <SidebarSection title="Due">
      {/* Overdue is a validation state, not a colour choice — `invalid`
          is what paints the border and the text red. */}
      <DateInput
        size="sm"
        invalid={overdue}
        value={task.due ?? ''}
        onChange={(e) => setDue(e.target.value)}
        aria-label="Due date"
        className="w-full"
      />
      {/* Under the input rather than beside it: the rail is 320px, and a date
          field plus "4 days late" plus Clear on one line wraps at every width. */}
      {(overdue || task.due) && (
        <div className="flex items-center justify-between gap-2 mt-[6px]">
          <span className="text-chip font-semibold text-danger-675">
            {overdue ? `Overdue · ${formatDaysLate(daysOverdue(task, selectedDate))}` : ''}
          </span>
          {task.due && (
            <LinkButton size="xs" onClick={() => setDue('')}>
              Clear
            </LinkButton>
          )}
        </div>
      )}
    </SidebarSection>
  );
}
