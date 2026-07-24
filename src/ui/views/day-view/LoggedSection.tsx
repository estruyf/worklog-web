import React from 'react';
import { eventTypeFromClientId, formatEventTypeLabel, isEventWorklogClientId } from '../../../model/worklog';
import type { WorklogEntry } from '../../../model/types';

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
        <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-675">LOGGED</span>
        {loggedHours > 0 && (
          <span className="inline-flex items-center px-[9px] py-[2px] rounded-full bg-brand-225 border border-brand-350 text-brand-650 text-[11px] font-semibold">
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
            className="flex items-center gap-2 px-[14px] py-2 bg-neutral-225 border border-neutral-225 rounded-full text-[13px] cursor-pointer text-neutral-825 hover:border-brand-500"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: isEventWorklogClientId(l.clientId) ? '#8B5CF6' : colorOf(l.clientId) }}
            />
            <span className="font-semibold">
              {isEventWorklogClientId(l.clientId) ? formatEventTypeLabel(eventTypeFromClientId(l.clientId)) : clientName(l.clientId)}
            </span>
            <span className="text-neutral-650">·</span>
            <span className="text-neutral-750">{typeLabel(l.hours)}</span>
            <span className="text-neutral-650">·</span>
            <span className="text-neutral-750">{l.hours}h</span>
            {!!l.note && (
              <>
                <span className="text-neutral-650">·</span>
                <span className="italic text-neutral-675">{l.note}</span>
              </>
            )}
          </button>
        ))}
        {dayLogs.length === 0 && <span className="text-[13px] text-neutral-625 italic">No time logged yet.</span>}
        <button onClick={openLogForm} className="flex items-center gap-[6px] px-3 py-2 border border-dashed border-neutral-550 rounded-full bg-white text-neutral-700 text-[13px] cursor-pointer hover:border-brand-500 hover:text-brand-800">
          + Log time
        </button>
      </div>
    </>
  );
}
