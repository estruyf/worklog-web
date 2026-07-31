import React from 'react';
import type { ClientTaskGroup } from '../../model';
import type { WorklogEntry } from '../../../model/types';
import { EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { TaskListToolbar } from '../../components';
import type { TaskListFilterApi } from '../../hooks';
import { GroupCard } from './GroupCard';

type OpenTasksSectionProps = {
  isTodaySel: boolean;
  editDayOpen: boolean;
  openGroups: ClientTaskGroup[];
  /** The day's open tasks are already narrowed by this; the section only renders
   *  its toolbar and explains an empty list it caused. */
  openFilter: TaskListFilterApi;
  dayLogs: WorklogEntry[];
  openTasksCount: number;
};

export function OpenTasksSection({
  isTodaySel,
  editDayOpen,
  openGroups,
  openFilter,
  dayLogs,
  openTasksCount,
}: OpenTasksSectionProps) {
  if (!isTodaySel && !editDayOpen) {
    return null;
  }

  return (
    <>
      <SectionLabel className="mb-[14px]">{isTodaySel ? 'Open tasks' : 'Edit day · open tasks'}</SectionLabel>
      {openFilter.toolbar && <TaskListToolbar {...openFilter.toolbar} />}
      {openGroups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
      {openGroups.length === 0 && (
        <EmptyState className="mb-[30px]">
          {openFilter.filtered ? (
            <>
              No open tasks match these filters.{' '}
              <LinkButton size="inherit" onClick={openFilter.reset} className="italic underline">
                Reset
              </LinkButton>
            </>
          ) : dayLogs.length === 0 ? (
            'Log time for a client above to see its open tasks here.'
          ) : openTasksCount === 0 ? (
            'No open tasks. Nice.'
          ) : (
            'No open tasks for the clients logged this day.'
          )}
        </EmptyState>
      )}
    </>
  );
}
