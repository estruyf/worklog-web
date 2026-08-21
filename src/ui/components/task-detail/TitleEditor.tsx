import React, { useRef, useState } from 'react';
import { PencilIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { IconButton, Input } from '../../primitives';
import { isDone } from '../../utils';
import { worklogStore } from '../../../data/worklogStore';

/** The task's title at the top of the detail panel, renameable in place.
 *
 *  A title is the one field you fix mid-thought — a typo, a phrasing that stopped
 *  matching the work — and sending that through the whole task form to change one
 *  line was the long way round. The form still owns everything else about the
 *  task; this owns the title and nothing more.
 *
 *  The heading stays plain text rather than becoming a button: a title is text you
 *  select and copy, and a click that opened an editor would take that away. The
 *  pencil beside it is the way in, on hover at desktop widths and always on a
 *  phone, the same treatment the notes and attachments rows use for their actions.
 *
 *  ↵ saves, Esc throws the edit away, and leaving the field saves what is in it —
 *  a rename is one line, so there is nothing here worth a Save button. An empty or
 *  unchanged title is not a write: `updateTask` would fall back to the old title
 *  anyway, and marking the file dirty to store the same bytes costs a commit. */
export function TitleEditor({ task }: { task: Task }) {
  // `null` is "not editing" — a draft can legitimately be empty while you retype.
  const [draft, setDraft] = useState<string | null>(null);
  // ↵ and Esc both unmount the input, and removing the focused element fires
  // blur — without this, Enter would save twice and Esc would save what it just
  // threw away.
  const closed = useRef(false);

  const close = (commit: boolean) => {
    closed.current = true;
    const next = (draft ?? '').trim();
    if (commit && next && next !== task.title) {
      worklogStore.updateTask(task.id, { title: next });
    }
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <Input
        autoFocus
        size="lg"
        variant="accent"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!closed.current) {
            close(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            close(true);
          } else if (e.key === 'Escape') {
            // Cancel the rename, not the whole detail panel — that listener sits
            // on window (see ../../WorklogApp).
            e.stopPropagation();
            close(false);
          }
        }}
        aria-label="Task title"
        className="w-full mb-5 font-bold"
      />
    );
  }

  return (
    <div className="group flex items-start gap-2 mb-5">
      <h1 className={'text-[26px] font-bold m-0 tracking-[-0.01em] ' + (isDone(task) ? 'line-through decoration-neutral-550 text-neutral-700' : '')}>
        {task.title}
      </h1>
      <IconButton
        size="sm"
        onClick={() => {
          closed.current = false;
          setDraft(task.title);
        }}
        aria-label="Rename task"
        title="Rename this task"
        className="mt-[6px] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
      >
        <PencilIcon size={15} />
      </IconButton>
    </div>
  );
}
