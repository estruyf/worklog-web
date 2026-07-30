import React from 'react';
import type { ClientTaskGroup } from '../../model';
import type { WorklogEntry } from '../../../model/types';
import { EmptyState, SectionLabel } from '../../primitives';
import { GroupCard } from './GroupCard';

type OpenTasksSectionProps = {
  isTodaySel: boolean;
  editDayOpen: boolean;
  openGroups: ClientTaskGroup[];
  dayLogs: WorklogEntry[];
  openTasksCount: number;
};

export function OpenTasksSection({ isTodaySel, editDayOpen, openGroups, dayLogs, openTasksCount }: OpenTasksSectionProps) {
  if (!isTodaySel && !editDayOpen) {
    return null;
  }

  return (
    <>
      <SectionLabel className="mb-[14px]">{isTodaySel ? 'Open tasks' : 'Edit day · open tasks'}</SectionLabel>
      {openGroups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
      {openGroups.length === 0 && (
        <EmptyState className="mb-[30px]">
          {dayLogs.length === 0
            ? 'Log time for a client above to see its open tasks here.'
            : openTasksCount === 0
              ? 'No open tasks. Nice.'
              : 'No open tasks for the clients logged this day.'}
        </EmptyState>
      )}
    </>
  );
}
