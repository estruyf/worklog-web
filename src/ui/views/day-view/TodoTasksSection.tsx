import React, { useState } from 'react';
import { Badge, Card, Pager, SectionLabel } from '../../primitives';
import { WorklogTaskRow } from '../../components';
import type { WorklogRow } from '../../model';

/** Open general to-dos (tasks not linked to any client). A persistent, personal
 *  list, independent of what was logged that day. It sits beside the day's work
 *  as a side panel from `xl:` up, so a long list never pushes the client
 *  sections down; only `pageSize` rows show at a time, the rest paginate. */
export function TodoTasksSection({ todoRows, pageSize }: { todoRows: WorklogRow[]; pageSize: number }) {
  const [page, setPage] = useState(1);

  if (todoRows.length === 0) {
    return null;
  }

  // Clamped rather than reset in an effect: completing to-dos shrinks the list
  // under the current page, and the render should already show the last one.
  const size = Math.max(1, pageSize);
  const pageCount = Math.ceil(todoRows.length / size);
  const current = Math.min(page, pageCount);
  const rows = todoRows.slice((current - 1) * size, (current - 1) * size + size);

  return (
    <>
      <div className="flex items-center gap-[10px] mb-3">
        <SectionLabel>To-dos</SectionLabel>
        <Badge>{todoRows.length}</Badge>
      </div>
      <Card padding="list" className="mb-[34px] xl:mb-0">
        {rows.map((row) => (
          <WorklogTaskRow key={row.id} row={row} />
        ))}

        {pageCount > 1 && (
          <Pager
            variant="compact"
            page={current}
            pageCount={pageCount}
            onPage={setPage}
            previousLabel="Previous to-dos"
            nextLabel="More to-dos"
            className="mt-[6px] px-2.5 py-2 border-t border-neutral-275"
          />
        )}
      </Card>
    </>
  );
}
