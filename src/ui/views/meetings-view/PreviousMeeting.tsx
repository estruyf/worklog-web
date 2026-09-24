import React from 'react';
import type { Meeting } from '../../../model/types';
import { Card, LinkButton, SectionLabel } from '../../primitives';
import { MarkdownView } from '../../components';
import { useData } from '../../context';
import { navigateToMeeting } from '../../router';
import { fmtLong, isActionDone } from '../../utils';

/** The last meeting with this client, beside the one being written: what is
 *  still open from it first, then what was said. Walking into a recurring meeting
 *  with last week's loose ends in view is most of what meeting notes are for.
 *
 *  Read-only on purpose — ticking last week's items is done in last week's
 *  meeting, a click away, not from the margin of this one. */
export function PreviousMeeting({ meeting }: { meeting: Meeting }) {
  const { taskById, clientName } = useData();
  const open = meeting.actions.filter((a) => !isActionDone(a, taskById));

  return (
    <>
      <SectionLabel className="mb-3">Last time with {meeting.clientId ? clientName(meeting.clientId) : 'them'}</SectionLabel>
      <Card padding="md" className="flex flex-col gap-3">
        <div>
          <LinkButton size="inherit" tone="neutral" onClick={() => navigateToMeeting(meeting.id)} className="font-bold text-row text-left">
            {meeting.title}
          </LinkButton>
          <div className="text-meta text-neutral-650 mt-[2px]">
            {fmtLong(meeting.date)}
            {meeting.time ? ` · ${meeting.time}` : ''}
          </div>
        </div>
        {open.length > 0 && (
          <div>
            <SectionLabel size="sm" className="mb-[6px]">
              Still open
            </SectionLabel>
            <ul className="m-0 pl-[18px] flex flex-col gap-[3px] text-control text-neutral-800 list-disc">
              {open.map((a, i) => (
                <li key={`${i}:${a.text}`}>{a.text}</li>
              ))}
            </ul>
          </div>
        )}
        {meeting.notes.trim() && (
          <Card tone="muted" padding="md" radius="panel" className="max-h-[320px] overflow-auto">
            <MarkdownView text={meeting.notes} className="text-control" />
          </Card>
        )}
      </Card>
    </>
  );
}
