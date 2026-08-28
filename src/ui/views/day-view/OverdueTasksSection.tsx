import React from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Badge, Card, LinkButton, SectionLabel } from '../../primitives';
import { TaskTable } from '../../components';
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
        <SectionLabel tone="danger">
          <TriangleAlertIcon size={13} strokeWidth={2} />
          Overdue
        </SectionLabel>
        <Badge tone="danger">{overdueRows.length}</Badge>
        <LinkButton size="xs" tone="muted" onClick={() => navigateToView('overdue')} className="ml-auto">
          See all
        </LinkButton>
      </div>
      <Card tone="danger" padding="list" className="mb-[34px]">
        <TaskTable rows={overdueRows} />
      </Card>
    </>
  );
}
