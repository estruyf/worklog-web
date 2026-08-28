import React, { useMemo } from 'react';
import type { ClientTaskGroup } from '../../model';
import { EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { TaskListToolbar, TaskTableGroups, useTaskTableLayout } from '../../components';
import type { TaskListFilterApi } from '../../hooks';
import { GroupCard } from './GroupCard';

type WorkedTasksSectionProps = {
  isTodaySel: boolean;
  workedGroups: ClientTaskGroup[];
  /** The day's worked tasks are already narrowed by this; the section only
   *  renders its toolbar and explains an empty list it caused. */
  filter: TaskListFilterApi;
};

export function WorkedTasksSection({ isTodaySel, workedGroups, filter }: WorkedTasksSectionProps) {
  // One column set across every client card, so the day's worked tasks read as
  // one table broken up by client rather than a column set per client.
  const layout = useTaskTableLayout(useMemo(() => workedGroups.flatMap((g) => g.rows), [workedGroups]));

  return (
    <>
      <SectionLabel className="mt-9 mb-[14px]">
        {isTodaySel ? 'Worked today (open)' : 'Worked this day (open)'}
      </SectionLabel>
      {filter.toolbar && <TaskListToolbar {...filter.toolbar} surface="page" />}
      {workedGroups.length > 0 ? (
        <TaskTableGroups layout={layout} sort={filter.sort}>
          {workedGroups.map((group) => (
            <GroupCard key={group.id} group={group} tone="worked" layout={layout} />
          ))}
        </TaskTableGroups>
      ) : (
        <EmptyState className="mb-[30px]">
          {filter.filtered ? (
            <>
              No worked tasks match these filters.{' '}
              <LinkButton size="inherit" onClick={filter.reset} className="italic underline">
                Reset
              </LinkButton>
            </>
          ) : (
            'No open tasks marked as worked for this day.'
          )}
        </EmptyState>
      )}
    </>
  );
}
