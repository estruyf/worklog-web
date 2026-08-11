import React, { useCallback, useRef, useState } from 'react';
import type { Task } from '../../../model/types';
import { Button, Card, EmptyState, LinkButton, SectionLabel, TextArea } from '../../primitives';
import { useData, useUi } from '../../context';
import { useMarkdownImages } from '../../hooks';
import { MarkdownView } from '../MarkdownView';
import { useTaskMention } from '../task-mention';

/** The task's progress log: timestamped Markdown notes, newest at the bottom, and
 *  the box that adds one. Separate from the description — that says what the task
 *  is, these say what has happened to it. */
export function NotesSection({ task }: { task: Task }) {
  const { addNote, updateNote, deleteNote } = useData();
  const { noteDraft, setNoteDraft, confirm } = useUi();
  const notes = task.notes ?? [];
  // The note being corrected, by its index in `notes`, and the text so far. Local
  // rather than in `useUi`: unlike the composer draft above it, an open correction
  // has nothing to say once the panel is gone.
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  // An image upload resolves after the fact, so the splice has to apply to the
  // text as it is *then* — hence a state setter rather than a plain callback.
  // Folding it back through `setEditing` keeps the index and the text together,
  // and an insert that lands after Cancel is dropped rather than resurrecting a
  // correction the user closed.
  const setEditText = useCallback<React.Dispatch<React.SetStateAction<string>>>((update) => {
    setEditing((e) => (e ? { ...e, text: typeof update === 'function' ? update(e.text) : update } : e));
  }, []);

  // One `#` picker per box: the composer and the correction are two fields that
  // can't be open at once, but they are two textareas either way. Same for the
  // image wiring — each box needs its own caret and its own file input.
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const composerMention = useTaskMention({ value: noteDraft, onChange: setNoteDraft, textareaRef: composerRef, selfId: task.id });
  const editMention = useTaskMention({
    value: editing?.text ?? '',
    onChange: setEditText,
    textareaRef: editRef,
    selfId: task.id,
  });
  const composerImg = useMarkdownImages(noteDraft, setNoteDraft);
  const editImg = useMarkdownImages(editing?.text ?? '', setEditText);

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
                      ref={editRef}
                      autoFocus
                      autoGrow
                      value={edit.text}
                      onChange={(e) => setEditing({ index: i, text: e.target.value })}
                      onPaste={editImg.onPaste}
                      onDrop={editImg.onDrop}
                      onDragOver={editImg.onDragOver}
                      {...editMention.props}
                      onKeyDown={(e) => {
                        // The open task list owns Escape, Enter and the arrows;
                        // what it took is marked handled.
                        editMention.props.onKeyDown(e);
                        if (e.defaultPrevented) {
                          return;
                        }
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
                    <div className="flex justify-between items-center gap-3">
                      <LinkButton size="xs" onClick={editImg.openFilePicker} disabled={editImg.uploading} className="font-medium">
                        {editImg.uploading ? 'Adding…' : '+ Add image'}
                      </LinkButton>
                      <div className="flex items-center gap-3">
                        <LinkButton size="xs" tone="muted" onClick={() => setEditing(null)}>
                          Cancel
                        </LinkButton>
                        <Button variant="primary" size="xs" onClick={onSaveEdit} disabled={!edit.text.trim()} className="font-semibold">
                          Save note
                        </Button>
                      </div>
                    </div>
                    {editImg.error && <div className="text-chip text-danger-675">{editImg.error}</div>}
                  </div>
                ) : (
                  <MarkdownView text={n.text} className="text-control-lg leading-[1.6]" />
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
          ref={composerRef}
          autoGrow
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onPaste={composerImg.onPaste}
          onDrop={composerImg.onDrop}
          onDragOver={composerImg.onDragOver}
          {...composerMention.props}
          onKeyDown={(e) => {
            composerMention.props.onKeyDown(e);
            if (e.defaultPrevented) {
              return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              onAddNote();
            }
          }}
          aria-label="New note"
          placeholder="Add a note… (⌘/Ctrl+Enter to save). Supports Markdown, # to link a task, and pasted or dropped images."
          className="w-full min-h-[68px] max-h-[60vh] leading-[1.55]"
        />
        {composerMention.panel}
        {editMention.panel}
        <div className="flex justify-between items-center gap-3">
          <LinkButton size="xs" onClick={composerImg.openFilePicker} disabled={composerImg.uploading} className="font-medium">
            {composerImg.uploading ? 'Adding…' : '+ Add image'}
          </LinkButton>
          <Button variant="primary" size="xs" onClick={onAddNote} disabled={!noteDraft.trim()} className="font-semibold">
            Add note
          </Button>
        </div>
        {composerImg.error && <div className="text-chip text-danger-675">{composerImg.error}</div>}
      </div>
      {/* One input per box: a single shared one would be pointed at whichever
          picker opened it last, and the two can be open at the same time. */}
      <input ref={composerImg.fileInputRef} type="file" accept="image/*" multiple onChange={composerImg.onFileChange} className="hidden" />
      <input ref={editImg.fileInputRef} type="file" accept="image/*" multiple onChange={editImg.onFileChange} className="hidden" />
    </div>
  );
}
