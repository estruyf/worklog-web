import React from 'react';
import type { Task } from '../../../model/types';
import type { StatusMetaFn } from '../../model';
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
      <div className="text-[11px] font-bold tracking-[0.06em] text-[#6E7781] mt-9 mb-[14px]">{isTodaySel ? 'DONE TODAY' : 'DONE THIS DAY'}</div>
      <div className="border border-[#ECEEF1] rounded-[14px] bg-[#FCFCFD] px-2 py-[6px]">
        {doneTasks.map((t) => (
          <div key={t.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-[#F4F5F7]">
            <button onClick={() => reopen(t)} title="Reopen" className="w-[17px] h-[17px] shrink-0 border-none rounded-full bg-[#16A34A] cursor-pointer p-0 flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </button>
            <span className="w-16 shrink-0 text-[10.5px] font-bold tracking-[0.05em] text-[#16A34A]">{statusMeta(t.status, true).label}</span>
            <span onClick={() => openDetail(t)} title="Open task" className="text-[14.5px] text-[#57606A] flex-1 line-through decoration-[#CDD3DA] cursor-pointer">
              {t.title}
            </span>
            <span className="text-[13px] text-[#8A9099]">{clientName(clientIdOf(t))}</span>
            {linksOf(t).length > 0 && (
              <a href={linksOf(t)[0]} target="_blank" rel="noreferrer noopener" className="text-[#9AA0A6] leading-[0] hover:text-[#2D6CDF]" title={linksOf(t)[0]}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7.5 8.5" />
                </svg>
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
