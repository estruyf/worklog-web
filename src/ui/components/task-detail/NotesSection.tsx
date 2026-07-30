import React, { useMemo } from 'react';
import type { Task } from '../../../model/types';
import { Button, Card, EmptyState, LinkButton, SectionLabel, TextArea } from '../../primitives';
import { useData, useUi } from '../../context';
import { makeImageResolver, renderMarkdown } from '../../utils';

/** The task's progress log: timestamped Markdown notes, newest at the bottom, and
 *  the box that adds one. Separate from the description — that says what the task
 *  is, these say what has happened to it. */
export function NotesSection({ task }: { task: Task }) {
  const { assetUrl, addNote, deleteNote } = useData();
  const { noteDraft, setNoteDraft, confirm } = useUi();
  // Notes render Markdown too; the description's own resolver lives inside
  // `DescriptionEditor`.
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);
  const notes = task.notes ?? [];

  const onAddNote = () => {
    const text = noteDraft.trim();
    if (!text) {
      return;
    }
    addNote(task.id, text);
    setNoteDraft('');
  };
  const onDeleteNote = async (index: number) => {
    const ok = await confirm.ask({
      title: 'Delete this note?',
      message: 'It is removed from the task file and cannot be recovered.',
      confirmLabel: 'Delete note',
      tone: 'danger',
    });
    if (ok) {
      deleteNote(task.id, index);
    }
  };

  return (
    <div className="mt-9">
      <SectionLabel className="mb-[10px]">Notes{notes.length > 0 ? ` · ${notes.length}` : ''}</SectionLabel>
      {notes.length > 0 ? (
        <div className="flex flex-col gap-[10px] mb-3">
          {notes.map((n, i) => (
            <Card key={i} tone="muted" radius="panel" className="group px-[16px] py-[11px]">
              <div className="flex items-center justify-between mb-[5px]">
                <span className="text-count font-semibold text-neutral-650">{n.timestamp}</span>
                <LinkButton
                  size="inherit"
                  tone="muted"
                  onClick={() => onDeleteNote(i)}
                  title="Delete note"
                  className="text-count opacity-0 group-hover:opacity-100"
                >
                  Delete
                </LinkButton>
              </div>
              <div className="wl-md text-control-lg leading-[1.6]" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.text, resolveImage) }} />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState size="sm" className="mb-3">No notes yet. Add one below to track progress on this task.</EmptyState>
      )}
      <div className="flex flex-col gap-2">
        <TextArea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onAddNote();
            }
          }}
          aria-label="New note"
          placeholder="Add a note… (⌘/Ctrl+Enter to save). Supports Markdown."
          className="w-full min-h-[68px] leading-[1.55]"
        />
        <div className="flex justify-end">
          <Button variant="primary" size="xs" onClick={onAddNote} disabled={!noteDraft.trim()} className="font-semibold">
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
