import React, { useMemo, useState } from 'react';
import type { Task } from '../../../model/types';
import { Button, Card, EmptyState, LinkButton, SectionLabel, TextArea } from '../../primitives';
import { useData, useUi } from '../../context';
import { makeImageResolver, renderMarkdown } from '../../utils';

/** The task's progress log: timestamped Markdown notes, newest at the bottom, and
 *  the box that adds one. Separate from the description — that says what the task
 *  is, these say what has happened to it. */
export function NotesSection({ task }: { task: Task }) {
  const { assetUrl, addNote, updateNote, deleteNote } = useData();
  const { noteDraft, setNoteDraft, confirm } = useUi();
  // Notes render Markdown too; the description's own resolver lives inside
  // `DescriptionEditor`.
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);
  const notes = task.notes ?? [];
  // The note being corrected, by its index in `notes`, and the text so far. Local
  // rather than in `useUi`: unlike the composer draft above it, an open correction
  // has nothing to say once the panel is gone.
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  const onAddNote = () => {
    const text = noteDraft.trim();
    if (!text) {
      return;
    }
    addNote(task.id, text);
    setNoteDraft('');
  };
  const onSaveEdit = () => {
    if (!editing || !editing.text.trim()) {
      return;
    }
    updateNote(task.id, editing.index, editing.text);
    setEditing(null);
  };
  const onDeleteNote = async (index: number) => {
    const ok = await confirm.ask({
      title: 'Delete this note?',
      message: 'It is removed from the task file and cannot be recovered.',
      confirmLabel: 'Delete note',
      tone: 'danger',
    });
    if (ok) {
      // Every note after it shifts down one, so an edit open on this card — or on
      // any card below it — would be pointed at the wrong note.
      setEditing(null);
      deleteNote(task.id, index);
    }
  };

  return (
    <div className="mt-9">
      <SectionLabel className="mb-[10px]">Notes{notes.length > 0 ? ` · ${notes.length}` : ''}</SectionLabel>
      {notes.length > 0 ? (
        <div className="flex flex-col gap-[10px] mb-3">
          {notes.map((n, i) => {
            const edit = editing?.index === i ? editing : null;
            return (
              <Card key={i} tone="muted" radius="panel" className="group px-[16px] py-[11px]">
                <div className="flex items-center justify-between gap-3 mb-[5px]">
                  <span className="text-count font-semibold text-neutral-650">{n.timestamp}</span>
                  {!edit && (
                    <div className="flex items-center gap-[10px] opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <LinkButton
                        size="inherit"
                        tone="muted"
                        onClick={() => setEditing({ index: i, text: n.text })}
                        title="Edit note"
                        className="text-count"
                      >
                        Edit
                      </LinkButton>
                      <LinkButton
                        size="inherit"
                        tone="muted"
                        onClick={() => onDeleteNote(i)}
                        title="Delete note"
                        className="text-count"
                      >
                        Delete
                      </LinkButton>
                    </div>
                  )}
                </div>
                {edit ? (
                  <div className="flex flex-col gap-2">
                    <TextArea
                      autoFocus
                      autoGrow
                      value={edit.text}
                      onChange={(e) => setEditing({ index: i, text: e.target.value })}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          onSaveEdit();
                        } else if (e.key === 'Escape') {
                          // Cancel the edit, not the whole detail panel — that
                          // listener sits on window (see ../../WorklogApp).
                          e.stopPropagation();
                          setEditing(null);
                        }
                      }}
                      aria-label={`Edit note from ${n.timestamp}`}
                      className="w-full min-h-[68px] max-h-[60vh] leading-[1.55]"
                    />
                    <div className="flex justify-end items-center gap-3">
                      <LinkButton size="xs" tone="muted" onClick={() => setEditing(null)}>
                        Cancel
                      </LinkButton>
                      <Button variant="primary" size="xs" onClick={onSaveEdit} disabled={!edit.text.trim()} className="font-semibold">
                        Save note
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="wl-md text-control-lg leading-[1.6]" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.text, resolveImage) }} />
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState size="sm" className="mb-3">No notes yet. Add one below to track progress on this task.</EmptyState>
      )}
      <div className="flex flex-col gap-2">
        <TextArea
          autoGrow
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
          className="w-full min-h-[68px] max-h-[60vh] leading-[1.55]"
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
