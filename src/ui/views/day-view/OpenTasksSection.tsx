import React from 'react';
import type { ClientTaskGroup } from '../../model';
import type { WorklogEntry } from '../../../model/types';
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
      <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-[14px]">{isTodaySel ? 'OPEN TASKS' : 'EDIT DAY · OPEN TASKS'}</div>
      {openGroups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          cardClassName="border border-neutral-375 rounded-[14px] bg-white mb-[14px] overflow-hidden"
          headerClassName="flex items-center gap-[9px] px-[18px] py-[13px] bg-neutral-75 border-b border-neutral-275 whitespace-nowrap"
          countBadgeClassName="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-neutral-325 text-neutral-675 text-[12px] font-semibold"
        />
      ))}
      {openGroups.length === 0 && (
        <div className="text-[14px] text-neutral-625 italic mb-[30px]">
          {dayLogs.length === 0
            ? 'Log time for a client above to see its open tasks here.'
            : openTasksCount === 0
              ? 'No open tasks. Nice.'
              : 'No open tasks for the clients logged this day.'}
        </div>
      )}
    </>
  );
}
