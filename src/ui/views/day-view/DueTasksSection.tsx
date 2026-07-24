import React from 'react';
import { WorklogTaskRow } from '../../components';
import type { WorklogRow } from '../../model';

export function DueTasksSection({ dueRows }: { dueRows: WorklogRow[] }) {
  if (dueRows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-3">DUE THIS DAY</div>
      <div className="border border-neutral-375 rounded-[14px] bg-white mb-[34px] px-2 py-[6px]">
        {dueRows.map((row) => (
          <WorklogTaskRow key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}
