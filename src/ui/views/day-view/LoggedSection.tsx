import React from 'react';
import { eventTypeFromClientId, formatEventTypeLabel, isEventWorklogClientId } from '../../../model/worklog';
import type { WorklogEntry } from '../../../model/types';
import { Badge, Chip, EmptyState, SectionLabel } from '../../primitives';

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
        <SectionLabel>Logged</SectionLabel>
        {loggedHours > 0 && (
          <Badge tone="brand" size="sm">
            {loggedHours}h · {loggedDays}d
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-[10px] mb-[34px] items-center">
        {/* Each entry is a chip that opens the log form on the entry it stands for
            — the row it edits is the row it is. */}
        {dayLogs.map((l, i) => (
          <button
            key={i}
            onClick={() => editLog(l.clientId)}
            title="Click to edit"
            className="flex items-center gap-2 px-[14px] py-2 bg-neutral-225 border border-neutral-225 rounded-full text-control cursor-pointer text-neutral-825 hover:border-brand-500"
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
        {dayLogs.length === 0 && <EmptyState size="sm">No time logged yet.</EmptyState>}
        <Chip variant="add" onClick={openLogForm}>
          + Log time
        </Chip>
      </div>
    </>
  );
}
