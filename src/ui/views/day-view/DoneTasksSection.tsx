import React from 'react';
import { CheckIcon, ExternalLinkIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import type { StatusMetaFn } from '../../model';
import { Card, SectionLabel } from '../../primitives';
import { clientIdOf, linksOf } from '../../utils';

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
          <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225">
            <button onClick={() => reopen(t)} title="Reopen" className="w-[17px] h-[17px] shrink-0 border-none rounded-full bg-success-500 text-white cursor-pointer p-0 flex items-center justify-center">
              <CheckIcon size={11} strokeWidth={2.5} />
            </button>
            <span className="w-16 shrink-0 text-status font-bold tracking-status text-success-500">{statusMeta(t.status, true).label}</span>
            <span onClick={() => openDetail(t)} title="Open task" className="text-row text-neutral-700 flex-1 line-through decoration-neutral-550 cursor-pointer">
              {t.title}
            </span>
            <span className="text-control text-neutral-650">{clientName(clientIdOf(t))}</span>
            {linksOf(t).length > 0 && (
              <a href={linksOf(t)[0]} target="_blank" rel="noreferrer noopener" className="text-neutral-625 leading-[0] hover:text-info" title={linksOf(t)[0]}>
                <ExternalLinkIcon size={14} />
              </a>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
