import React from 'react';
import type { Task } from '../../../model/types';
import { CompletedTaskRow } from '../../components';
import { Card, EmptyState, SectionLabel } from '../../primitives';
import { useData } from '../../context';
import { fmtShort } from '../../utils';

/** The client's closed tasks, newest first. The meta column is the completion
 *  date: in a list that is all one client's, that is the only fact the rows
 *  don't already share. */
export function CompletedTaskList({ tasks, clientName }: { tasks: Task[]; clientName: string }) {
  const { statusMeta, openDetail } = useData();
  return (
    <>
      <SectionLabel className="mb-[14px]">Recently completed</SectionLabel>
      {tasks.length === 0 ? (
        <EmptyState>Nothing archived yet for {clientName || 'this client'}.</EmptyState>
      ) : (
        <Card tone="muted" padding="list">
          {tasks.map((t) => (
            <CompletedTaskRow
              key={t.id}
              task={t}
              onOpen={() => openDetail(t)}
              status={statusMeta(t.status, true).label}
              meta={t.completed ? fmtShort(t.completed) : ''}
            />
          ))}
        </Card>
      )}
    </>
  );
}
