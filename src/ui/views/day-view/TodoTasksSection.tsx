import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { WorklogTaskRow } from '../../components';
import type { WorklogRow } from '../../model';

/** Open general to-dos (tasks not linked to any client). A persistent, personal
 *  list, independent of what was logged that day. It sits beside the day's work
 *  as a side panel from `xl:` up, so a long list never pushes the client
 *  sections down; only `pageSize` rows show at a time, the rest paginate. */
export function TodoTasksSection({ todoRows, pageSize }: { todoRows: WorklogRow[]; pageSize: number }) {
  const [page, setPage] = useState(0);

  if (todoRows.length === 0) {
    return null;
  }

  // Clamped rather than reset in an effect: completing to-dos shrinks the list
  // under the current page, and the render should already show the last one.
  const size = Math.max(1, pageSize);
  const pageCount = Math.ceil(todoRows.length / size);
  const current = Math.min(page, pageCount - 1);
  const rows = todoRows.slice(current * size, current * size + size);

  return (
    <>
      <div className="flex items-center gap-[10px] mb-3">
        <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-675">TO-DOS</span>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-neutral-325 text-neutral-675 text-[12px] font-semibold">
          {todoRows.length}
        </span>
      </div>
      <div className="border border-neutral-375 rounded-[14px] bg-white mb-[34px] xl:mb-0 px-2 py-[6px]">
        {rows.map((row) => (
          <WorklogTaskRow key={row.id} row={row} />
        ))}

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 mt-[6px] px-2.5 py-2 border-t border-neutral-275">
            <button
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              title="Previous to-dos"
              className="w-[22px] h-[22px] shrink-0 flex items-center justify-center border border-neutral-400 rounded-md bg-white text-neutral-700 cursor-pointer hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              <ChevronLeftIcon size={13} />
            </button>
            <span className="text-[12px] text-neutral-675">
              {current + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage(current + 1)}
              disabled={current === pageCount - 1}
              title="More to-dos"
              className="w-[22px] h-[22px] shrink-0 flex items-center justify-center border border-neutral-400 rounded-md bg-white text-neutral-700 cursor-pointer hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              <ChevronRightIcon size={13} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
