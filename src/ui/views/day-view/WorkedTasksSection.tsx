import React from 'react';
import type { ClientTaskGroup } from '../../model';
import { GroupCard } from './GroupCard';

export function WorkedTasksSection({ isTodaySel, workedGroups }: { isTodaySel: boolean; workedGroups: ClientTaskGroup[] }) {
  return (
    <>
      <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mt-9 mb-[14px]">{isTodaySel ? 'WORKED TODAY (OPEN)' : 'WORKED THIS DAY (OPEN)'}</div>
      {workedGroups.length > 0 ? (
        workedGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            cardClassName="border border-neutral-375 rounded-[14px] bg-brand-50 mb-[14px] overflow-hidden"
            headerClassName="flex items-center gap-[9px] px-[18px] py-[13px] bg-brand-125 border-b border-brand-350 whitespace-nowrap"
            countBadgeClassName="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-brand-250 text-brand-625 text-[12px] font-semibold"
          />
        ))
      ) : (
        <div className="text-[14px] text-neutral-625 italic mb-[30px]">No open tasks marked as worked for this day.</div>
      )}
    </>
  );
}
