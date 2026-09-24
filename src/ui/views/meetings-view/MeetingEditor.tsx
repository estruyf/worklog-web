// One meeting, open across the pane: when and with whom along the top, the notes
// you are typing in the middle, what came out of it underneath, and the last
// meeting with the same client in the margin.
//
// Everything on this page is a *draft* until Save is pressed. Nothing here writes
// Markdown as you type: a meeting is written during the meeting, and re-parsing
// the whole file map on every pause made the page announce "Saving…" over and
// over while someone was still talking. What the typing does reach is the
// device-side draft (`data/meetingDrafts`), which is why a Save button costs
// nothing — a closed lid keeps the notes, it just doesn't commit them.
//
// Save writes the whole meeting through in one go and drops the draft. That is
// also the moment auto-sync hears about it, under the `meeting` event.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimerIcon, Trash2Icon } from 'lucide-react';
import type { Meeting, MeetingAction } from '../../../model/types';
import { formatDuration, parseDuration } from '../../../parser/meetingParser';
import { nowStamp } from '../../../util/date';
import { Button, Card, DateInput, Field, Input, ViewHeader } from '../../primitives';
import { ClientPicker, DescriptionEditor, MARKDOWN_CHEATSHEET, type DescriptionDraftMode } from '../../components';
import { useData } from '../../context';
import { closeMeeting } from '../../router';
import { previousMeeting } from '../../utils';
import { ActionItems } from './ActionItems';
import { PeopleField } from './PeopleField';
import { PreviousMeeting } from './PreviousMeeting';

/** How long editing has to pause before the draft is mirrored to the device.
 *  Only IndexedDB is touched — no parse, no rebuild — so this can be short. */
const DRAFT_SAVE_DELAY = 500;

const PLACEHOLDER = `What was said, what was decided…\n\n${MARKDOWN_CHEATSHEET}`;

/** Everything about a meeting this page can change, in the shape `saveMeeting`
 *  takes — so saving is a hand-off, not a translation. */
type Draft = {
  title: string;
  date: string;
  time: string | null;
  duration: number | null;
  clientId: string | null;
  people: string[];
  notes: string;
  actions: MeetingAction[];
};

function draftOf(meeting: Meeting): Draft {
  return {
    title: meeting.title,
    date: meeting.date,
    time: meeting.time ?? null,
    duration: meeting.duration ?? null,
    clientId: meeting.clientId ?? null,
    people: meeting.people,
    notes: meeting.notes,
    actions: meeting.actions,
  };
}

/** Value equality, which is the only kind that means anything here: every
 *  rebuild anywhere in the app hands this page a freshly parsed `Meeting`, so
 *  identity would report an edit on someone else's keystroke. */
function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

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

export function MeetingEditor({ meeting }: { meeting: Meeting }) {
  const {
    meetings,
    knownPeople,
    today,
    saveMeeting,
    meetingDraft,
    saveMeetingDraft,
    deleteMeeting,
    makeTaskFromAction,
  } = useData();
  const previous = useMemo(() => previousMeeting(meetings, meeting), [meetings, meeting]);
  const [mode, setMode] = useState<DescriptionDraftMode>('edit');

  // What is on screen, and the meeting as this page last saw it. The difference
  // between the two is the whole state of the page: it is what "Unsaved" means,
  // what gets mirrored to the device, and what Save writes.
  const [draft, setDraft] = useState<Draft>(() => draftOf(meeting));
  const [base, setBase] = useState<Draft>(() => draftOf(meeting));
  const dirty = !sameDraft(draft, base);
  const [saving, setSaving] = useState(false);

  const latest = useRef(draft);
  const current = useRef(base);
  useEffect(() => {
    latest.current = draft;
    current.current = base;
  });

  // Save normalizes on the way in (a title is one line, people lose commas), so
  // the meeting that comes back is not byte-for-byte what was typed. Adopt it
  // anyway — otherwise the page would report itself unsaved the moment it saved.
  // Cleared by the next edit, which is the only thing that outranks it.
  const adoptNext = useRef(false);

  const update = useCallback((patch: Partial<Draft>) => {
    adoptNext.current = false;
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  // `DescriptionEditor` wants a setter, because an image drop splices a ref in at
  // the caret and has to see the text as it is at that moment.
  const setNotes = useCallback<React.Dispatch<React.SetStateAction<string>>>((value) => {
    adoptNext.current = false;
    setDraft((d) => ({ ...d, notes: typeof value === 'function' ? value(d.notes) : value }));
  }, []);

  // A change from underneath — a pull, the other device, the task an action item
  // just became — replaces the draft only when there is nothing unsaved in it.
  useEffect(() => {
    const next = draftOf(meeting);
    if (adoptNext.current || sameDraft(latest.current, current.current)) {
      setDraft(next);
    }
    setBase(next);
  }, [meeting]);

  // What this device was typing when it was last here. Applied only if nothing
  // has been typed since the page opened — the stored draft is older than that.
  useEffect(() => {
    let cancelled = false;
    void meetingDraft(meeting.id).then((fields) => {
      if (cancelled || !fields || !sameDraft(latest.current, current.current)) {
        return;
      }
      setDraft({ ...current.current, ...fields });
    });
    return () => {
      cancelled = true;
    };
  }, [meeting.id, meetingDraft]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const timer = setTimeout(() => void saveMeetingDraft(meeting.id, draft), DRAFT_SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [dirty, draft, meeting.id, saveMeetingDraft]);

  // Leaving mid-pause — Back, a nav tab, the next meeting — mirrors what the
  // timer above was about to. The refs are read at unmount on purpose: the latest
  // draft is the one to keep, not the one this effect first saw.
  useEffect(() => {
    const id = meeting.id;
    const refs = { latest, current };
    return () => {
      if (!sameDraft(refs.latest.current, refs.current.current)) {
        void saveMeetingDraft(id, refs.latest.current);
      }
    };
  }, [meeting.id, saveMeetingDraft]);

  const save = useCallback(async () => {
    if (sameDraft(latest.current, current.current)) {
      return;
    }
    setSaving(true);
    adoptNext.current = true;
    try {
      await saveMeeting(meeting.id, latest.current);
    } finally {
      setSaving(false);
    }
  }, [meeting.id, saveMeeting]);

  // ⌘S is the reflex for a page with a Save button, and the browser's own Save
  // is not what anyone means while typing meeting notes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // An action item only becomes a task once the block holds it, so this saves
  // first. The task's id is then written onto the item by the service, and the
  // effect above adopts it.
  const onMakeTask = useCallback(
    async (index: number) => {
      await save();
      await makeTaskFromAction(meeting, index);
    },
    [save, makeTaskFromAction, meeting],
  );

  // "End now" works the duration out from the start time, so the one thing you
  // have to do as the meeting ends is press it. Only today has a now.
  const elapsed = useMemo(() => {
    if (draft.date !== today || !draft.time || draft.duration) {
      return undefined;
    }
    const [h, m] = draft.time.split(':').map(Number);
    const [nh, nm] = nowStamp().slice(11, 16).split(':').map(Number);
    const minutes = nh * 60 + nm - (h * 60 + m);
    return minutes > 0 ? minutes : undefined;
  }, [draft.date, draft.time, draft.duration, today]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex flex-wrap items-center gap-3">
        <Button variant="neutral" size="xs" onClick={closeMeeting} className="shrink-0">
          ‹ Meetings
        </Button>
        <MeetingTitle key={`title-${meeting.id}`} title={draft.title} onRename={(title) => update({ title })} />
        <span
          className="shrink-0 text-status text-neutral-625"
          title={dirty ? 'Kept on this device until you save' : 'Written to your repo'}
          aria-live="polite"
        >
          {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
        </span>
        <Button variant="primary" size="xs" onClick={() => void save()} disabled={!dirty || saving} className="shrink-0">
          Save
        </Button>
        <Button
          variant="danger"
          size="xs"
          onClick={() => void deleteMeeting(meeting)}
          className="shrink-0 inline-flex items-center gap-[5px]"
        >
          <Trash2Icon size={13} aria-hidden="true" />
          Delete
        </Button>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-20">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-x-8 gap-y-8">
            <div className="min-w-0">
              <Card padding="md" className="mb-6">
                {/* Three fields across, each filling its column: the controls carry
                    no width of their own (see controlStyles), and left to their
                    intrinsic size they sat in a row of mostly empty card. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Date" labelSize="sm">
                    <DateInput
                      size="sm"
                      className="w-full"
                      value={draft.date}
                      onChange={(e) => e.target.value && update({ date: e.target.value })}
                    />
                  </Field>
                  <Field label="Start" labelSize="sm">
                    <Input
                      size="sm"
                      type="time"
                      className="w-full"
                      value={draft.time ?? ''}
                      onChange={(e) => update({ time: e.target.value || null })}
                    />
                  </Field>
                  <Field
                    label="Duration"
                    labelSize="sm"
                    className="col-span-2 sm:col-span-1"
                    action={
                      elapsed !== undefined && (
                        <button
                          type="button"
                          onClick={() => update({ duration: elapsed })}
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
                      className="w-full"
                      value={draft.duration ? formatDuration(draft.duration) : ''}
                      placeholder="45m"
                      // Something unreadable leaves the stored value alone rather
                      // than clearing it; an emptied field is how you clear it.
                      onCommit={(text) => {
                        const minutes = parseDuration(text);
                        if (minutes || !text.trim()) {
                          update({ duration: minutes ?? null });
                        }
                      }}
                    />
                  </Field>
                </div>
                {/* The same chip row a task is filed with, so "which client" is
                    one control in this app and not two. */}
                <Field label="Client" labelSize="sm" className="mt-4">
                  <ClientPicker
                    value={draft.clientId ?? ''}
                    onChange={(clientId) => update({ clientId: clientId || null })}
                    noneLabel="No client"
                  />
                </Field>
                <Field label="People" labelSize="sm" className="mt-4">
                  <PeopleField value={draft.people} onChange={(people) => update({ people })} suggestions={knownPeople} />
                </Field>
              </Card>

              <DescriptionEditor
                value={draft.notes}
                onChange={setNotes}
                mode={mode}
                onModeChange={setMode}
                title="Notes"
                placeholder={PLACEHOLDER}
                onTaskToggle={setNotes}
              />

              <ActionItems
                actions={draft.actions}
                onChange={(actions) => update({ actions })}
                onMakeTask={(index) => void onMakeTask(index)}
              />
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
