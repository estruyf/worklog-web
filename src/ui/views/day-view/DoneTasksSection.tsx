import React from 'react';
import type { Task } from '../../../model/types';
import type { StatusMetaFn } from '../../model';
import { CompletedTaskRow } from '../../components';
import { Card, SectionLabel } from '../../primitives';
import { clientIdOf } from '../../utils';

type DoneTasksSectionProps = {
  doneTasks: Task[];
  isTodaySel: boolean;
  reopen: (task: Task) => void;
  openDetail: (task: Task) => void;
  statusMeta: StatusMetaFn;
  clientName: (clientId: string) => string;
};

export function DoneTasksSection({ doneTasks, isTodaySel, reopen, openDetail, statusMeta, clientName }: DoneTasksSectionProps) {
  if (doneTasks.length === 0) {
    return null;
  }

  return (
    <>
      <SectionLabel className="mt-9 mb-[14px]">{isTodaySel ? 'Done today' : 'Done this day'}</SectionLabel>
      <Card tone="muted" padding="list">
        {doneTasks.map((t) => (
          <CompletedTaskRow
            key={t.id}
            task={t}
            onOpen={() => openDetail(t)}
            onReopen={() => reopen(t)}
            status={statusMeta(t.status, true).label}
            statusColor={statusMeta(t.status, true).color}
            meta={clientName(clientIdOf(t))}
            showLink
          />
        ))}
      </Card>
    </>
  );
}
