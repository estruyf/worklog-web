import React from 'react';
import { WorklogTaskRow } from '../../components';
import type { WorklogRow } from '../../model';

/** Open general to-dos (tasks not linked to any client). Shown as a persistent,
 *  always-available personal list, independent of what was logged that day. */
export function TodoTasksSection({ todoRows }: { todoRows: WorklogRow[] }) {
  if (todoRows.length === 0) {
    return null;
  }

  return (
    <>
      <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-3">TO-DOS</div>
      <div className="border border-neutral-375 rounded-[14px] bg-white mb-[34px] px-2 py-[6px]">
        {todoRows.map((row) => (
          <WorklogTaskRow key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}
