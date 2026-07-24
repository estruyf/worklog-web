import React from 'react';
import { ClientTaskGroup } from '../../model';
import { GroupCard } from './GroupCard';

export function WorkedTasksSection({ isTodaySel, workedGroups }: { isTodaySel: boolean; workedGroups: ClientTaskGroup[] }) {
  return (
    <>
      <div className="text-[11px] font-bold tracking-[0.06em] text-[#6E7781] mt-9 mb-[14px]">{isTodaySel ? 'WORKED TODAY (OPEN)' : 'WORKED THIS DAY (OPEN)'}</div>
      {workedGroups.length > 0 ? (
        workedGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            cardClassName="border border-[#ECEEF1] rounded-[14px] bg-[#FFFCF3] mb-[14px] overflow-hidden"
            headerClassName="flex items-center gap-[9px] px-[18px] py-[13px] bg-[#FFF6DE] border-b border-[#F0E3BC] whitespace-nowrap"
            countBadgeClassName="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-[#F7E9BD] text-[#8A5A00] text-[12px] font-semibold"
          />
        ))
      ) : (
        <div className="text-[14px] text-[#9AA0A6] italic mb-[30px]">No open tasks marked as worked for this day.</div>
      )}
    </>
  );
}
