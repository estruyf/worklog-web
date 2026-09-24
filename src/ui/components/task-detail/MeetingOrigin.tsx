import React from 'react';
import { UsersIcon } from 'lucide-react';
import { LinkButton } from '../../primitives';
import { useData } from '../../context';
import { navigateToMeeting } from '../../router';
import { fmtShort } from '../../utils';

/** "From: Acme weekly sync, 24 Sep" under the title of a task that was made from
 *  a meeting's action item. The link is read off the meeting's `→ t_…` rather
 *  than stored on the task, so the task's own Markdown carries no trace of it —
 *  this is the only place the two meet. */
export function MeetingOrigin({ taskId }: { taskId: string }) {
  const { meetingOfTask, features } = useData();
  const meeting = features.meetings ? meetingOfTask.get(taskId) : undefined;
  if (!meeting) {
    return null;
  }
  return (
    <div className="flex items-center gap-[6px] -mt-3 mb-5 text-control text-neutral-675">
      <UsersIcon size={13} aria-hidden="true" />
      From
      <LinkButton size="inherit" onClick={() => navigateToMeeting(meeting.id)}>
        {meeting.title}
      </LinkButton>
      <span>· {fmtShort(meeting.date)}</span>
    </div>
  );
}
