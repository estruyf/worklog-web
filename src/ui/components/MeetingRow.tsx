import React from 'react';
import { UsersIcon } from 'lucide-react';
import type { Meeting } from '../../model/types';
import { formatDuration } from '../../parser/meetingParser';
import { Badge } from '../primitives';
import { useData } from '../context';
import { navigateToMeeting } from '../router';
import { fmtShort, openActionCount } from '../utils';

export interface MeetingRowProps {
  meeting: Meeting;
  /** Lead with the date rather than the time — off where every row is one day. */
  showDate?: boolean;
  /** Leave the client off where every row is the same client's. */
  showClient?: boolean;
}

/** One meeting in a list: when, what, whose, and who. The one row every list of
 *  meetings uses — the Meetings view, a day, a client — so they read alike. The
 *  open-items count is there because an unfinished action item is the thing a
 *  list of old meetings is worth scanning for. */
export function MeetingRow({ meeting, showDate = false, showClient = true }: MeetingRowProps) {
  const { clientName, colorOf, taskById } = useData();
  const open = openActionCount(meeting, taskById);
  const when = [showDate ? fmtShort(meeting.date) : '', meeting.time ?? ''].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={() => navigateToMeeting(meeting.id)}
      className="flex items-center gap-3 w-full text-left px-2.5 py-[9px] rounded-control-md cursor-pointer hover:bg-neutral-125"
    >
      <span className="w-[92px] shrink-0 text-meta text-neutral-675 tabular-nums">{when || '—'}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-row font-medium truncate">{meeting.title}</span>
        {(meeting.people.length > 0 || (showClient && meeting.clientId)) && (
          <span className="flex items-center gap-[10px] mt-[2px] text-meta text-neutral-650 min-w-0">
            {showClient && meeting.clientId && (
              <span className="flex items-center gap-[6px] shrink-0">
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: colorOf(meeting.clientId) }} />
                {clientName(meeting.clientId)}
              </span>
            )}
            {meeting.people.length > 0 && (
              <span className="flex items-center gap-[5px] min-w-0">
                <UsersIcon size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{meeting.people.join(', ')}</span>
              </span>
            )}
          </span>
        )}
      </span>
      {meeting.duration && (
        <span className="shrink-0 text-meta text-neutral-650 tabular-nums">{formatDuration(meeting.duration)}</span>
      )}
      {open > 0 && (
        <Badge size="sm" title={`${open} open action ${open === 1 ? 'item' : 'items'}`}>
          {open}
        </Badge>
      )}
    </button>
  );
}
