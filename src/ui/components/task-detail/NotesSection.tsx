import React, { useCallback, useRef, useState } from 'react';
import type { Task } from '../../../model/types';
import { isValidISODate } from '../../../util/date';
import { Button, LinkButton, TextArea } from '../../primitives';
import { useData, useUi } from '../../context';
import { useMarkdownImages } from '../../hooks';
import { MOD_KEY, weekdayShort } from '../../utils';
import { MarkdownView } from '../MarkdownView';
import { useMarkdownFormat } from '../markdown-format';
import { useTaskMention } from '../task-mention';

/** "Mon 3" — the weekday and day a note was written, which is what someone
 *  scanning the log is reading for. The stored stamp keeps the year and the time,
 *  so it stays on the row as its title rather than being thrown away. */
function stampLabel(stamp: string): string {
  const date = stamp.slice(0, 10);
  return isValidISODate(date) ? `${weekdayShort(date)} ${Number(date.slice(8))}` : stamp;
}

/** The task's progress log: the box that adds a note, then the notes themselves
 *  newest first, so what you just wrote lands directly under the box you wrote it
 *  in. Separate from the description — that says what the task is, these say what
 *  has happened to it.
 *
 *  `bare` drops the section's top rule and margin, for the phone sheet where the
 *  dialog's title bar already says "Notes" and owns the spacing. */
export function NotesSection({ task, bare = false }: { task: Task; bare?: boolean }) {
  const { addNote, updateNote, deleteNote } = useData();
  const { noteDraft, setNoteDraft, confirm } = useUi();
  const notes = task.notes ?? [];
  // Whether the composer is open. Starts open on a draft carried over from
  // another task — `noteDraft` outlives the panel, and a draft behind a collapsed
  // box is a draft nobody knows is there.
  const [composing, setComposing] = useState(() => noteDraft.trim() !== '');
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
  const composerFormat = useMarkdownFormat({
    value: noteDraft,
    onChange: setNoteDraft,
    textareaRef: composerRef,
    image: { onAdd: composerImg.openFilePicker, busy: composerImg.uploading },
  });
  const editFormat = useMarkdownFormat({
    value: editing?.text ?? '',
    onChange: setEditText,
    textareaRef: editRef,
    image: { onAdd: editImg.openFilePicker, busy: editImg.uploading },
  });

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
    <div className={bare ? undefined : 'mt-8 pt-5 border-t border-neutral-375'}>
      {/* Collapsed until it is clicked: most visits to a task read the log rather
          than add to it, and an editor sitting open at the top of it says
          otherwise. Once opened it stays open — the box you are typing in must
          not resize under you, and the draft outlives the panel anyway. */}
      {composing ? (
        <div className="flex flex-col gap-2">
          <TextArea
            ref={composerRef}
            header={composerFormat.toolbar}
            autoFocus
            autoGrow
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onPaste={composerImg.onPaste}
            onDrop={composerImg.onDrop}
            onDragOver={composerImg.onDragOver}
            {...composerMention.props}
            onKeyDown={(e) => {
              composerMention.props.onKeyDown(e);
              composerFormat.props.onKeyDown(e);
              if (e.defaultPrevented) {
                return;
              }
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onAddNote();
              }
            }}
            aria-label="New note"
            placeholder="What happened on this task? Markdown, # to link a task, and pasted or dropped images."
            className="w-full"
            textareaClassName="min-h-[96px] max-h-[60vh] leading-[1.55]"
          />
          <div className="flex justify-end items-center gap-3">
            <Button variant="primary" size="xs" onClick={onAddNote} disabled={!noteDraft.trim()} className="font-semibold">
              Add note
            </Button>
          </div>
          {composerImg.error && <div className="text-chip text-danger-675">{composerImg.error}</div>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="w-full flex items-center justify-between gap-3 px-[14px] py-[11px] rounded-control-md border border-neutral-450 bg-neutral-100 text-left text-control-lg cursor-text hover:bg-white hover:border-neutral-500"
        >
          <span className="truncate text-neutral-675">
            What happened on this task? <span className="text-neutral-625">Markdown, # to link a task</span>
          </span>
          <span className="shrink-0 text-count text-neutral-625">{MOD_KEY}↵</span>
        </button>
      )}
      {/* Newest first, over the stored order — the index each row carries is its
          place in the file, which is what an edit or a delete is addressed by. */}
      {notes.length > 0 && (
        <div className="flex flex-col mt-2">
          {notes
            .map((n, i) => ({ n, i }))
            .reverse()
            .map(({ n, i }) => {
              const edit = editing?.index === i ? editing : null;
              return (
                <div key={i} className="group flex items-start gap-4 py-[11px] border-t border-neutral-375 first:border-t-0">
                  <span title={n.timestamp} className="shrink-0 w-[52px] pt-[3px] text-count text-neutral-650">
                    {stampLabel(n.timestamp)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {edit ? (
                      <div className="flex flex-col gap-2">
                        <TextArea
                          ref={editRef}
                          header={editFormat.toolbar}
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
                            // Then the formatting shortcuts, which take ⌘B and a
                            // plain ↵ inside a list; both bail on a handled event.
                            editFormat.props.onKeyDown(e);
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
                          className="w-full"
                          textareaClassName="min-h-[68px] max-h-[60vh] leading-[1.55]"
                        />
                        {/* Adding an image is on the formatting bar above now, so
                            this row is only the two ways out of the correction. */}
                        <div className="flex justify-end items-center gap-3">
                          <LinkButton size="xs" tone="muted" onClick={() => setEditing(null)}>
                            Cancel
                          </LinkButton>
                          <Button variant="primary" size="xs" onClick={onSaveEdit} disabled={!edit.text.trim()} className="font-semibold">
                            Save note
                          </Button>
                        </div>
                        {editImg.error && <div className="text-chip text-danger-675">{editImg.error}</div>}
                      </div>
                    ) : (
                      <MarkdownView text={n.text} className="text-control-lg leading-[1.6]" />
                    )}
                  </div>
                  {!edit && (
                    // Hover-revealed only where there is a hover: on a phone — where
                    // these live in the notes sheet — they stay visible.
                    <div className="shrink-0 flex items-center gap-[10px] pt-[3px] lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
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
              );
            })}
        </div>
      )}
      {composerMention.panel}
      {editMention.panel}
      {/* One input per box: a single shared one would be pointed at whichever
          picker opened it last, and the two can be open at the same time. */}
      <input ref={composerImg.fileInputRef} type="file" accept="image/*" multiple onChange={composerImg.onFileChange} className="hidden" />
      <input ref={editImg.fileInputRef} type="file" accept="image/*" multiple onChange={editImg.onFileChange} className="hidden" />
    </div>
  );
}
