import React, { useMemo, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Card, EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { MeetingRow } from '../../components';
import { useData } from '../../context';

/** How many of a client's meetings show before "Show all" — the recent ones are
 *  what you open a client for; the rest is the Meetings view's job. */
const RECENT = 5;

/** The client's meetings, newest first, with a way to start the next one already
 *  pointed at them. */
export function ClientMeetings({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { meetings, startMeeting } = useData();
  const [all, setAll] = useState(false);
  const mine = useMemo(() => meetings.filter((m) => m.clientId === clientId), [meetings, clientId]);
  const shown = all ? mine : mine.slice(0, RECENT);

  return (
    <section className="mb-[38px]">
      <div className="flex items-center justify-between gap-3 mb-[14px]">
        <SectionLabel>Meetings · {mine.length}</SectionLabel>
        <LinkButton
          size="sm"
          tone="neutral"
          onClick={() => void startMeeting({ clientId })}
          className="inline-flex items-center gap-[5px] no-underline hover:no-underline"
        >
          <PlusIcon size={13} aria-hidden="true" />
          New meeting
        </LinkButton>
      </div>
      {mine.length === 0 ? (
        <EmptyState>No meetings with {clientName || 'this client'} yet.</EmptyState>
      ) : (
        <Card padding="list">
          {shown.map((m) => (
            <MeetingRow key={m.id} meeting={m} showDate showClient={false} />
          ))}
          {mine.length > RECENT && (
            <div className="px-2.5 py-2 border-t border-neutral-275 mt-[6px]">
              <LinkButton size="sm" onClick={() => setAll((v) => !v)}>
                {all ? 'Show fewer' : `Show all ${mine.length}`}
              </LinkButton>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
