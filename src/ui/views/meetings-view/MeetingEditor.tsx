// One meeting, open across the pane: when and with whom along the top, the notes
// you are typing in the middle, and what came out of it underneath — one column,
// so the notes get the full width.
//
// The small fields — date, time, client, people, action items — save as they are
// changed, the way a task's rail does. The notes are a draft with Cancel and Save,
// the way a task description is: they are the one part written at length, and
// saving every pause in a sentence would arm a sync for each one.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TimerIcon, Trash2Icon } from 'lucide-react';
import type { Meeting } from '../../../model/types';
import { formatDuration, parseDuration } from '../../../parser/meetingParser';
import { nowStamp } from '../../../util/date';
import { Button, Card, DateInput, Field, Input, ViewHeader } from '../../primitives';
import { ClientChipPicker, DescriptionEditor, MARKDOWN_CHEATSHEET, type DescriptionMode } from '../../components';
import { useData } from '../../context';
import { closeMeeting, isFreshMeetingEntry } from '../../router';
import { ActionItems } from './ActionItems';
import { PeopleField } from './PeopleField';

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
 *  the task title's arrangement. A meeting that was just started opens with the
 *  field up and empty, so the first thing typed is its name. Left empty, the file
 *  keeps the name the meeting was created with ("Meeting", or "<Client> meeting"):
 *  a `## ` heading with nothing after it stops being a heading the moment an
 *  editor strips the trailing space, and the block would stop being a meeting. */
function MeetingTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(isFreshMeetingEntry);
  const [blank, setBlank] = useState(isFreshMeetingEntry);
  if (editing) {
    return (
      <CommitInput
        value={blank ? '' : title}
        placeholder="Meeting title"
        aria-label="Meeting title"
        autoFocus
        size="lg"
        className="flex-1 min-w-0 font-bold"
        onCommit={(text) => text.trim() && onRename(text)}
        onDone={() => {
          setEditing(false);
          setBlank(false);
        }}
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

/** The notes, written when you press Save (or ⌘↵) — the arrangement a task
 *  description and a day note have, so notes are committed as the thing you meant
 *  rather than every pause in a sentence. Keyed by the meeting in the parent, so a
 *  draft never follows you into the next one. */
function MeetingNotes({ meeting }: { meeting: Meeting }) {
  const { updateMeeting } = useData();
  const [draft, setDraft] = useState(meeting.notes);
  // A meeting with nothing written yet opens on the editor: starting one is the
  // usual way here, and the notes are what you came to type.
  const [mode, setMode] = useState<DescriptionMode>(meeting.notes.trim() ? 'read' : 'edit');
  // Reading, the draft is the stored notes — including a change a sync brings in.
  // Editing, it is yours until Save or Cancel.
  useEffect(() => {
    if (mode === 'read') {
      setDraft(meeting.notes);
    }
  }, [meeting.notes, mode]);
  const dirty = draft !== meeting.notes;

  // Takes the text rather than reading the draft, so a box ticked while reading
  // saves the line it just flipped.
  const saveText = (text: string) => {
    setDraft(text);
    void updateMeeting(meeting.id, { notes: text });
    setMode('read');
  };
  const cancel = () => {
    setDraft(meeting.notes);
    setMode('read');
  };

  return (
    <DescriptionEditor
      value={draft}
      onChange={setDraft}
      mode={mode}
      onModeChange={setMode}
      title="Notes"
      placeholder={PLACEHOLDER}
      onSubmit={dirty ? () => saveText(draft) : undefined}
      // Reading, a tick is the whole edit and saves itself; mid-edit it is part of
      // the draft, and Save still decides — the task description's rule.
      onTaskToggle={mode === 'read' ? saveText : setDraft}
      action={
        mode === 'read' ? (
          draft.trim() !== '' && (
            <Button variant="neutral" size="xs" onClick={() => setMode('edit')}>
              Edit
            </Button>
          )
        ) : (
          <>
            <Button variant="neutral" size="xs" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" size="xs" onClick={() => saveText(draft)} disabled={!dirty} className="font-semibold">
              Save
            </Button>
          </>
        )
      }
    />
  );
}

export function MeetingEditor({ meeting }: { meeting: Meeting }) {
  const { knownPeople, today, updateMeeting, deleteMeeting } = useData();
  const save = (fields: Parameters<typeof updateMeeting>[1]) => void updateMeeting(meeting.id, fields);

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
          <Card padding="md" className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            </div>
            {/* A row of its own: the chips need the width a grid cell doesn't have. */}
            <Field label="Client" labelSize="sm" className="mt-4">
              <ClientChipPicker
                value={meeting.clientId ?? ''}
                onChange={(clientId) => save({ clientId: clientId || null })}
                noneLabel="No client"
                framed={false}
              />
            </Field>
            <Field label="People" labelSize="sm" className="mt-4">
              <PeopleField value={meeting.people} onChange={(people) => save({ people })} suggestions={knownPeople} />
            </Field>
          </Card>

          <MeetingNotes key={meeting.id} meeting={meeting} />

          <ActionItems meeting={meeting} onChange={(actions) => save({ actions })} />
        </div>
      </div>
    </div>
  );
}
