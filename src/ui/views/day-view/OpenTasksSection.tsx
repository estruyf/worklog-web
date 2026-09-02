import React, { useMemo } from 'react';
import { KanbanIcon } from 'lucide-react';
import type { ClientTaskGroup } from '../../model';
import type { WorklogEntry } from '../../../model/types';
import { Button, EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { TaskListToolbar, TaskTableGroups, useTaskTableLayout } from '../../components';
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
  /** Opens the same tasks as a board, in the full window. */
  onOpenBoard: () => void;
};

export function OpenTasksSection({
  isTodaySel,
  editDayOpen,
  openGroups,
  openFilter,
  dayLogs,
  openTasksCount,
  onOpenBoard,
}: OpenTasksSectionProps) {
  // Built across every client card, so the day's open work reads as one table
  // broken up by client rather than a column set per client.
  const layout = useTaskTableLayout(useMemo(() => openGroups.flatMap((g) => g.rows), [openGroups]));

  if (!isTodaySel && !editDayOpen) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-[14px]">
        <SectionLabel>{isTodaySel ? 'Open tasks' : 'Edit day · open tasks'}</SectionLabel>
        {/* Offered only when there is something to lay out: a board of empty
            columns is a worse answer than the line explaining why the list is. */}
        {openGroups.length > 0 && (
          <Button size="xs" onClick={onOpenBoard} title="See the day's open tasks as a board — a column per status">
            <KanbanIcon size={13} />
            Board
          </Button>
        )}
      </div>
      {openFilter.toolbar && <TaskListToolbar {...openFilter.toolbar} surface="page" />}
      {openGroups.length > 0 && (
        <TaskTableGroups layout={layout} sort={openFilter.sort}>
          {openGroups.map((group) => (
            <GroupCard key={group.id} group={group} layout={layout} />
          ))}
        </TaskTableGroups>
      )}
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
