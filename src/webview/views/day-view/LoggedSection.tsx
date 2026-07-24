import React from 'react';
import { eventTypeFromClientId, formatEventTypeLabel, isEventWorklogClientId } from '../../../model/worklog';
import { WorklogEntry } from '../../../model/types';

type LoggedSectionProps = {
  dayLogs: WorklogEntry[];
  loggedHours: number;
  loggedDays: number;
  colorOf: (clientId: string) => string;
  clientName: (clientId: string) => string;
  typeLabel: (hours: number) => string;
  editLog: (clientId: string) => void;
  openLogForm: () => void;
};

export function LoggedSection({ dayLogs, loggedHours, loggedDays, colorOf, clientName, typeLabel, editLog, openLogForm }: LoggedSectionProps) {
  return (
    <>
      <div className="flex items-center gap-[10px] mb-3">
        <span className="text-[11px] font-bold tracking-[0.06em] text-[#6E7781]">LOGGED</span>
        {loggedHours > 0 && (
          <span className="inline-flex items-center px-[9px] py-[2px] rounded-full bg-[#FBEFC0] border border-[#F0E3BC] text-[#7A5600] text-[11px] font-semibold">
            {loggedHours}h · {loggedDays}d
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-[10px] mb-[34px] items-center">
        {dayLogs.map((l, i) => (
          <button
            key={i}
            onClick={() => editLog(l.clientId)}
            title="Click to edit"
            className="flex items-center gap-2 px-[14px] py-2 bg-[#F4F5F7] border border-[#F4F5F7] rounded-full text-[13px] cursor-pointer text-[#1F2328] hover:border-[#E2BE2E]"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: isEventWorklogClientId(l.clientId) ? '#8B5CF6' : colorOf(l.clientId) }}
            />
            <span className="font-semibold">
              {isEventWorklogClientId(l.clientId) ? formatEventTypeLabel(eventTypeFromClientId(l.clientId)) : clientName(l.clientId)}
            </span>
            <span className="text-[#8A9099]">·</span>
            <span className="text-[#3C4149]">{typeLabel(l.hours)}</span>
            <span className="text-[#8A9099]">·</span>
            <span className="text-[#3C4149]">{l.hours}h</span>
            {!!l.note && (
              <>
                <span className="text-[#8A9099]">·</span>
                <span className="italic text-[#6E7781]">{l.note}</span>
              </>
            )}
          </button>
        ))}
        {dayLogs.length === 0 && <span className="text-[13px] text-[#9AA0A6] italic">No time logged yet.</span>}
        <button onClick={openLogForm} className="flex items-center gap-[6px] px-3 py-2 border border-dashed border-[#CDD3DA] rounded-full bg-white text-[#57606A] text-[13px] cursor-pointer hover:border-[#E2BE2E] hover:text-[#3A2E05]">
          + Log time
        </button>
      </div>
    </>
  );
}
