import React from 'react';
import type { Meeting } from '../../../model/types';
import { Badge, Card, SectionLabel } from '../../primitives';
import { MeetingRow } from '../../components';

/** The meetings held on the day being viewed, in the order they happened. Renders
 *  nothing on a day without one: the way to add one is the day card's footer,
 *  not an empty box on every day of the year. */
export function MeetingsSection({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return null;
  }
  return (
    <>
      <div className="flex items-center gap-[10px] mb-3">
        <SectionLabel>Meetings</SectionLabel>
        <Badge>{meetings.length}</Badge>
      </div>
      <Card padding="list" className="mb-[34px]">
        {meetings.map((m) => (
          <MeetingRow key={m.id} meeting={m} />
        ))}
      </Card>
    </>
  );
}
