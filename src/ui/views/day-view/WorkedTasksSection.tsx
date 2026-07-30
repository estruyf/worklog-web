import React from 'react';
import type { ClientTaskGroup } from '../../model';
import { EmptyState, SectionLabel } from '../../primitives';
import { GroupCard } from './GroupCard';

export function WorkedTasksSection({ isTodaySel, workedGroups }: { isTodaySel: boolean; workedGroups: ClientTaskGroup[] }) {
  return (
    <>
      <SectionLabel className="mt-9 mb-[14px]">
        {isTodaySel ? 'Worked today (open)' : 'Worked this day (open)'}
      </SectionLabel>
      {workedGroups.length > 0 ? (
        workedGroups.map((group) => <GroupCard key={group.id} group={group} tone="worked" />)
      ) : (
        <EmptyState className="mb-[30px]">No open tasks marked as worked for this day.</EmptyState>
      )}
    </>
  );
}
