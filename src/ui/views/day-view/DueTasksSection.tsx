import React from 'react';
import { TaskTable } from '../../components';
import { Card, SectionLabel } from '../../primitives';
import type { WorklogRow } from '../../model';

export function DueTasksSection({ dueRows }: { dueRows: WorklogRow[] }) {
  if (dueRows.length === 0) {
    return null;
  }

  return (
    <>
      <SectionLabel className="mb-3">Due this day</SectionLabel>
      <Card padding="list" className="mb-[34px]">
        <TaskTable rows={dueRows} />
      </Card>
    </>
  );
}
