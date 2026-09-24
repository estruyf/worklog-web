// Meeting notes: the record of a call — who was on it, what was said, what came
// out of it — each one a block in `meetings/<YYYY-MM>.md`, on the day it happened
// and against the client it was with.
//
// Two states, the way the Lists view has them: the list of every meeting, and
// one meeting open across the whole pane at /app/meetings/<id>. The open one is
// the page you type into while the meeting runs, so it gets the room.

import React, { useEffect } from 'react';
import { useData } from '../context';
import { closeMeeting, replaceWithMeetings, useOpenMeetingId } from '../router';
import { MeetingEditor, MeetingList } from './meetings-view';

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

export function MeetingsView() {
  const { meetings } = useData();
  const openId = useOpenMeetingId();
  const open = openId === null ? undefined : meetings.find((m) => m.id === openId);

  // A URL naming a meeting that isn't there — deleted here, or on another device
  // and synced in. The list is the honest answer, as it is for a missing list.
  useEffect(() => {
    if (openId !== null && !open) {
      replaceWithMeetings();
    }
  }, [openId, open]);

  // Escape leaves the meeting — but not from inside the notes or a field, where
  // it is the last key you'd want to cost you the page you are typing on.
  useEffect(() => {
    if (openId === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditableTarget(e.target)) {
        closeMeeting();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  return open ? <MeetingEditor key={open.id} meeting={open} /> : <MeetingList />;
}
