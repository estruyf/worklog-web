// The day card's footer: the two things you can do to a day that the bar itself
// doesn't offer, and the confirmation that the second one landed.
//
// The verbs live here rather than each growing its own section because they are
// both edits to the same object. An unwritten day is then the meter plus one
// quiet row — the note costs no height until it has something in it.

import React from 'react';
import { NotebookPenIcon, PlusIcon } from 'lucide-react';
import { LinkButton } from '../../primitives';

export interface DayCardFooterProps {
  onLogTime: () => void;
  onEditNote: () => void;
  /** Whether the day already carries a note — the verb changes, not the action. */
  hasNote: boolean;
  /** The note editor is open. It carries its own Cancel and Save, so the footer
   *  drops its note verb rather than offer a third, vaguer way out of the same
   *  editor — one that would have to either discard silently or do nothing. */
  editingNote: boolean;
  /** Local "HH:mm" of the last save in this session, or '' if there wasn't one. */
  noteSavedAt: string;
}

export function DayCardFooter({ onLogTime, onEditNote, hasNote, editingNote, noteSavedAt }: DayCardFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 pt-3 border-t border-neutral-325">
      <LinkButton size="md" tone="neutral" onClick={onLogTime} className="inline-flex items-center gap-[6px] no-underline hover:no-underline">
        <PlusIcon size={14} aria-hidden="true" />
        Log time
      </LinkButton>
      {!editingNote && (
        <LinkButton
          size="md"
          tone="neutral"
          onClick={onEditNote}
          className="inline-flex items-center gap-[6px] no-underline hover:no-underline"
        >
          <NotebookPenIcon size={14} aria-hidden="true" />
          {hasNote ? 'Edit note' : 'Add note'}
        </LinkButton>
      )}
      {noteSavedAt && <span className="ml-auto text-status text-neutral-625">note saved {noteSavedAt}</span>}
    </div>
  );
}
