// One meeting, open across the pane: when and with whom along the top, the notes
// you are typing in the middle, what came out of it underneath, and the last
// meeting with the same client in the margin.
//
// Everything saves as it is changed. A meeting is written *during* the meeting —
// there is no moment to press Save, and a draft that only exists on screen is a
// draft a closed laptop lid throws away. The fields commit on change or on blur;
// the notes commit on a short pause in typing, and on the way out.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TimerIcon, Trash2Icon } from 'lucide-react';
import type { Meeting } from '../../../model/types';
import { formatDuration, parseDuration } from '../../../parser/meetingParser';
import { nowStamp } from '../../../util/date';
import { Button, Card, DateInput, Field, Input, Select, ViewHeader } from '../../primitives';
import { DescriptionEditor, MARKDOWN_CHEATSHEET, type DescriptionDraftMode } from '../../components';
import { useData } from '../../context';
import { closeMeeting } from '../../router';
import { previousMeeting } from '../../utils';
import { ActionItems } from './ActionItems';
import { PeopleField } from './PeopleField';
import { PreviousMeeting } from './PreviousMeeting';

/** How long typing has to pause before the notes are written. Short enough that
 *  a closed tab loses a sentence at most; long enough that a rebuild of the whole
 *  file map isn't run per keystroke. */
const NOTES_SAVE_DELAY = 800;

const PLACEHOLDER = `What was said, what was decided…\n\n${MARKDOWN_CHEATSHEET}`;

/** A text field that holds its own value while focused and commits on ↵ or blur.
 *  Esc puts the stored value back and stays inside the field — out here, Esc
 *  closes the meeting. */
function CommitInput({
  value,
  onCommit,
  onDone,
  ...rest
}: {
  value: string;
  onCommit: (text: string) => void;
  /** Called once the field is left, however it was left. */
  onDone?: () => void;
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value);
  // Follow the stored value when it changes underneath — a sync, or the "End now"
  // button filling in the duration — unless you are the one mid-edit.
  const [focused, setFocused] = useState(false);
  // Esc can unmount the field (the title's), and removing a focused element
  // fires a blur — which must not then commit what Esc just abandoned.
  const abandoned = useRef(false);
  useEffect(() => {
    if (!focused) {
      setText(value);
    }
  }, [value, focused]);
  return (
    <Input
      {...rest}
      value={text}
      onChange={(e) => {
        abandoned.current = false;
        setText(e.target.value);
      }}
      onFocus={() => {
        abandoned.current = false;
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        if (text !== value && !abandoned.current) {
          onCommit(text);
        }
        onDone?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          abandoned.current = true;
          setText(value);
          onDone?.();
        }
      }}
    />
  );
}

/** The title as a heading, and a field in its place while it is being renamed —
 *  the task title's arrangement. A new meeting starts as "Meeting", and naming it
 *  is one click on the name. */
function MeetingTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <CommitInput
        value={title}
        aria-label="Meeting title"
        autoFocus
        size="lg"
        className="flex-1 min-w-0 font-bold"
        onCommit={(text) => text.trim() && onRename(text)}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <h1 className="flex-1 min-w-0 m-0 text-[22px] font-bold truncate">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Rename"
        className="max-w-full truncate text-left bg-transparent border-none p-0 cursor-text"
      >
        {title}
      </button>
    </h1>
  );
}

/** The notes, saved on a pause in typing. Keyed by the meeting in the parent, so
 *  a draft never follows you into the next one. */
function MeetingNotes({ meeting }: { meeting: Meeting }) {
  const { updateMeeting } = useData();
  const [draft, setDraft] = useState(meeting.notes);
  const [mode, setMode] = useState<DescriptionDraftMode>('edit');
  // What the file holds as far as this editor knows. The draft differs from it
  // exactly while there is typing not yet written.
  const saved = useRef(meeting.notes);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  });

  // A change from outside — a pull, the other device — replaces the draft only
  // when there is nothing unsaved in it; the save this editor makes comes back
  // through here too, and must not undo the typing done since it went out.
  useEffect(() => {
    if (latest.current === saved.current) {
      setDraft(meeting.notes);
    }
    saved.current = meeting.notes;
  }, [meeting.notes]);

  useEffect(() => {
    if (draft === saved.current) {
      return;
    }
    const timer = setTimeout(() => void updateMeeting(meeting.id, { notes: draft }), NOTES_SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft, meeting.id, updateMeeting]);

  // Leaving mid-pause — Back, a nav tab, the next meeting — writes what the timer
  // above was about to. The refs are read at unmount on purpose: the latest draft
  // is the one to keep, not the one this effect first saw.
  useEffect(() => {
    const id = meeting.id;
    const refs = { saved, latest };
    return () => {
      if (refs.latest.current !== refs.saved.current) {
        void updateMeeting(id, { notes: refs.latest.current });
      }
    };
  }, [meeting.id, updateMeeting]);

  return (
    <DescriptionEditor
      value={draft}
      onChange={setDraft}
      mode={mode}
      onModeChange={setMode}
      title="Notes"
      placeholder={PLACEHOLDER}
      onTaskToggle={setDraft}
      action={
        <span className="text-status text-neutral-625" aria-live="polite">
          {draft === saved.current ? 'Saved' : 'Saving…'}
        </span>
      }
    />
  );
}

export function MeetingEditor({ meeting }: { meeting: Meeting }) {
  const { meetings, clients, allClients, knownPeople, today, updateMeeting, deleteMeeting } = useData();
  const save = (fields: Parameters<typeof updateMeeting>[1]) => void updateMeeting(meeting.id, fields);
  const previous = useMemo(() => previousMeeting(meetings, meeting), [meetings, meeting]);

  // An archived client stays pickable on a meeting that already names it; new
  // meetings only get the ones you still work with.
  const clientOptions = useMemo(() => {
    const current = allClients.find((c) => c.id === meeting.clientId);
    return current?.archived ? [...clients, current] : clients;
  }, [clients, allClients, meeting.clientId]);

  // "End now" works the duration out from the start time, so the one thing you
  // have to do as the meeting ends is press it. Only today has a now.
  const elapsed = useMemo(() => {
    if (meeting.date !== today || !meeting.time || meeting.duration) {
      return undefined;
    }
    const [h, m] = meeting.time.split(':').map(Number);
    const [nh, nm] = nowStamp().slice(11, 16).split(':').map(Number);
    const minutes = nh * 60 + nm - (h * 60 + m);
    return minutes > 0 ? minutes : undefined;
  }, [meeting.date, meeting.time, meeting.duration, today]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex items-center gap-3">
        <Button variant="neutral" size="xs" onClick={closeMeeting} className="shrink-0">
          ‹ Meetings
        </Button>
        <MeetingTitle key={`title-${meeting.id}`} title={meeting.title} onRename={(title) => save({ title })} />
        <Button variant="danger" size="xs" onClick={() => void deleteMeeting(meeting)} className="shrink-0 inline-flex items-center gap-[5px]">
          <Trash2Icon size={13} aria-hidden="true" />
          Delete
        </Button>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-20">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-x-8 gap-y-8">
            <div className="min-w-0">
              <Card padding="md" className="mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Date" labelSize="sm">
                    <DateInput size="sm" value={meeting.date} onChange={(e) => e.target.value && save({ date: e.target.value })} />
                  </Field>
                  <Field label="Start" labelSize="sm">
                    <Input size="sm" type="time" value={meeting.time ?? ''} onChange={(e) => save({ time: e.target.value || null })} />
                  </Field>
                  <Field
                    label="Duration"
                    labelSize="sm"
                    action={
                      elapsed !== undefined && (
                        <button
                          type="button"
                          onClick={() => save({ duration: elapsed })}
                          title={`Set the duration to ${formatDuration(elapsed)}, from the start time to now`}
                          className="inline-flex items-center gap-[3px] text-meta font-medium text-info cursor-pointer hover:underline"
                        >
                          <TimerIcon size={12} aria-hidden="true" />
                          End now
                        </button>
                      )
                    }
                  >
                    <CommitInput
                      size="sm"
                      value={meeting.duration ? formatDuration(meeting.duration) : ''}
                      placeholder="45m"
                      // Something unreadable leaves the stored value alone rather
                      // than clearing it; an emptied field is how you clear it.
                      onCommit={(text) => {
                        const minutes = parseDuration(text);
                        if (minutes || !text.trim()) {
                          save({ duration: minutes ?? null });
                        }
                      }}
                    />
                  </Field>
                  <Field label="Client" labelSize="sm">
                    <Select size="sm" value={meeting.clientId ?? ''} onChange={(e) => save({ clientId: e.target.value || null })}>
                      <option value="">No client</option>
                      {clientOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="People" labelSize="sm" className="mt-4">
                  <PeopleField value={meeting.people} onChange={(people) => save({ people })} suggestions={knownPeople} />
                </Field>
              </Card>

              <MeetingNotes key={meeting.id} meeting={meeting} />

              <ActionItems meeting={meeting} onChange={(actions) => save({ actions })} />
            </div>

            {previous && (
              <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
                <PreviousMeeting meeting={previous} />
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
