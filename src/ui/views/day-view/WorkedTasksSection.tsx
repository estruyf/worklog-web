import React from 'react';
import type { ClientTaskGroup } from '../../model';
import { EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { TaskListToolbar } from '../../components';
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
  return (
    <>
      <SectionLabel className="mt-9 mb-[14px]">
        {isTodaySel ? 'Worked today (open)' : 'Worked this day (open)'}
      </SectionLabel>
      {filter.toolbar && <TaskListToolbar {...filter.toolbar} />}
      {workedGroups.length > 0 ? (
        workedGroups.map((group) => <GroupCard key={group.id} group={group} tone="worked" />)
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
