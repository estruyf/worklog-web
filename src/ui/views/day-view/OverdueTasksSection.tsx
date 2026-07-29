import React from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { WorklogTaskRow } from '../../components';
import { navigateToView } from '../../router';
import type { WorklogRow } from '../../model';

/** Open tasks whose due date is already behind the day being viewed. First block
 *  on the page on purpose: a recurring task that fell on a weekend rolls its due
 *  date only when it's completed, so Monday's overview is where it has to speak
 *  up — it won't appear under "due this day" any more. */
export function OverdueTasksSection({ overdueRows }: { overdueRows: WorklogRow[] }) {
  if (overdueRows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-[10px] mb-3">
        <span className="flex items-center gap-[6px] text-[11px] font-bold tracking-[0.06em] text-danger-675">
          <TriangleAlertIcon size={13} strokeWidth={2} />
          OVERDUE
        </span>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-danger-100 border border-danger-200 text-danger-675 text-[12px] font-semibold">
          {overdueRows.length}
        </span>
        <button
          onClick={() => navigateToView('overdue')}
          className="ml-auto text-[12px] text-neutral-675 bg-transparent border-none p-0 cursor-pointer hover:text-danger-675 hover:underline"
        >
          See all
        </button>
      </div>
      <div className="border border-danger-200 rounded-[14px] bg-white mb-[34px] px-2 py-[6px]">
        {overdueRows.map((row) => (
          <WorklogTaskRow key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}
