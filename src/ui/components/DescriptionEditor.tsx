import React from 'react';
import { Card, SectionLabel, SegmentedControl, TextArea, cn } from '../primitives';
import { useMarkdownImages } from '../hooks';
import { MarkdownView } from './MarkdownView';
import { useMarkdownFormat } from './markdown-format';
import { useTaskMention } from './task-mention';

/** `boxed` is the task form's editor: the tabs and the image action ride on the
 *  box the two modes swap inside, because that box *is* the field. `inline` is the
 *  detail panel's: the controls sit in the section header beside "Description",
 *  and the preview is a card rather than the inside of a frame. */
export type DescriptionEditorVariant = 'boxed' | 'inline';

/** `read` is not editing at all: the description as it is stored, with whatever
 *  way in the call site puts in `action`. `edit` and `preview` are two views of
 *  the *draft* — one editor, open, that you can look at rendered and go back
 *  from without deciding anything. Keeping `read` distinct from `preview` is
 *  what makes Save and Cancel mean something: in `preview` there is still an
 *  edit in hand. A surface that is only ever an editor — the task form — never
 *  passes `read`. */
export type DescriptionMode = 'read' | 'edit' | 'preview';

/** The two halves of an open editor — what the toggle switches between, and the
 *  only thing this component ever asks for. Leaving `read` is the call site's
 *  own action, so a surface that never opens one can hold just these two. */
export type DescriptionDraftMode = Exclude<DescriptionMode, 'read'>;

/** The Markdown cheatsheet every placeholder ends with. It lives here for the
 *  same reason it always did: two copies of it drift, and the one that drifts is
 *  the one nobody is looking at. Callers vary only the opening line. */
export const MARKDOWN_CHEATSHEET =
  '## Notes\n- supports **bold**, *italic*, `code`\n- [links](https://example.com) or plain https://example.com\n- # to link another task\n- lists, > quotes\n- [ ] task lists — tick them in Preview\n- paste, drop or add an image';

const PLACEHOLDER = `Add a description in Markdown…\n\n${MARKDOWN_CHEATSHEET}`;

/** The toggle offers the two halves of an open editor; `read` is left by the
 *  call site's own action, not by a tab. */
const MODES: { value: DescriptionDraftMode; label: string }[] = [
  { value: 'edit', label: 'Write' },
  { value: 'preview', label: 'Preview' },
];

/** Markdown is written in a monospaced face — the cheatsheet's alignment, the
 *  fences and the tables all assume one. */
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

export interface DescriptionEditorProps {
  value: string;
  /** A state setter rather than a plain callback: image drops splice a ref in at
   *  the caret, which has to be applied to the text as it is at that moment. */
  onChange: React.Dispatch<React.SetStateAction<string>>;
  mode: DescriptionMode;
  onModeChange: (mode: DescriptionDraftMode) => void;
  variant?: DescriptionEditorVariant;
  /** The heading, and the editor's accessible name. It is a heading rather than a
   *  `<label>` on purpose: in preview mode there is no control for it to point at,
   *  and a label pointing at nothing is worse than none. */
  title?: string;
  /** The parenthetical after a `boxed` heading. */
  hint?: string;
  /** Sits after the mode toggle — the detail panel's Edit, or its Cancel/Save. */
  action?: React.ReactNode;
  /** Empty-textarea prompt. Override it to name what is being written; compose
   *  it with {@link MARKDOWN_CHEATSHEET} so the syntax reminder comes along. */
  placeholder?: string;
  /** Ticking a `- [ ]` box in a rendered body. Separate from {@link onChange}
   *  because the two are not the same act, and which one a tick is depends on
   *  the mode: in `preview` there is an editor open and a tick is an edit to its
   *  draft, while in `read` there is nothing to press Save in and a tick has to
   *  save itself. The call site decides. Omit it and the boxes render read-only. */
  onTaskToggle?: (next: string) => void;
  /** The task this description belongs to, kept out of its own `#` picker. Absent
   *  on a task that does not exist yet. */
  taskId?: string;
}

/** Markdown description editor: a formatting bar and a write/preview toggle while
 *  it is open, image paste / drop / pick, and a click-to-edit empty state. The
 *  task form and the task detail panel both edit a description; this is the one
 *  that does it. In `read` it is the same body with the editing furniture gone. */
export function DescriptionEditor({
  value,
  onChange,
  mode,
  onModeChange,
  variant = 'inline',
  title = 'Description',
  hint,
  action,
  placeholder = PLACEHOLDER,
  onTaskToggle,
  taskId,
}: DescriptionEditorProps) {
  const img = useMarkdownImages(value, onChange);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  // One ref for both variants: only one of the two textareas is ever mounted.
  const mention = useTaskMention({ value, onChange, textareaRef, selfId: taskId });
  const format = useMarkdownFormat({
    value,
    onChange,
    textareaRef,
    image: { onAdd: img.openFilePicker, busy: img.uploading },
  });
  // The picker goes first and marks what it took — an open list owns Enter.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    mention.props.onKeyDown(e);
    format.props.onKeyDown(e);
  };
  const boxed = variant === 'boxed';
  // One height for all three bodies, so switching tabs doesn't resize the page
  // under the pointer. The inline editor sets it on the textarea only — its
  // preview is a card that sizes to its prose.
  const tall = boxed ? 'min-h-[300px] lg:min-h-[420px]' : 'min-h-[280px]';

  // The toggle belongs to an open editor: in `read` there is no draft to preview,
  // and the header carries the way in and nothing else. Adding an image is on the
  // formatting bar, which is up only while writing — for the same reason, plus it
  // is an edit at the caret, like everything else on that bar.
  const toggle = mode !== 'read' && (
    <SegmentedControl
      aria-label={`${title} mode`}
      variant={boxed ? 'raised' : 'joined'}
      size={boxed ? 'md' : 'sm'}
      options={MODES}
      value={mode}
      onChange={onModeChange}
    />
  );

  const body =
    mode === 'edit' ? (
      boxed ? (
        // Borderless: the box around it already draws the field, and a second
        // border inside one reads as a frame in a frame.
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={img.onPaste}
          onDrop={img.onDrop}
          onDragOver={img.onDragOver}
          {...mention.props}
          onKeyDown={onKeyDown}
          aria-label={title}
          placeholder={placeholder}
          className={cn(
            'block w-full px-[14px] py-[12px] text-touch md:text-control-lg leading-[1.6] outline-none focus:outline-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)] resize-y focus-visible:outline-brand-500!',
            tall,
          )}
          style={MONO}
        />
      ) : (
        <TextArea
          ref={textareaRef}
          size="lg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={img.onPaste}
          onDrop={img.onDrop}
          onDragOver={img.onDragOver}
          {...mention.props}
          onKeyDown={onKeyDown}
          aria-label={title}
          placeholder={placeholder}
          className={cn('w-full leading-[1.6]', tall)}
          style={MONO}
        />
      )
    ) : value.trim() ? (
      boxed ? (
        <MarkdownView text={value} className={cn('px-[8px] py-[4px]', tall)} onTextChange={onTaskToggle} />
      ) : (
        <Card tone="muted" padding="md" radius="panel">
          <MarkdownView text={value} onTextChange={onTaskToggle} />
        </Card>
      )
    ) : (
      // A button, not a div: "click to add" was unreachable by keyboard in both
      // editors, which left preview mode a dead end for anyone not using a mouse.
      <button
        type="button"
        onClick={() => onModeChange('edit')}
        className={cn(
          'block w-full text-left text-body text-neutral-625 italic cursor-text',
          boxed ? cn('px-[18px] py-[18px]', tall) : 'border border-dashed border-neutral-450 rounded-panel px-[18px] py-[22px]',
        )}
      >
        No description yet. Click to add Markdown notes.
      </button>
    );

  const fileInput = <input ref={img.fileInputRef} type="file" accept="image/*" multiple onChange={img.onFileChange} className="hidden" />;
  const error = img.error && <div className="text-chip text-danger-675 mt-2">{img.error}</div>;

  if (boxed) {
    return (
      <div>
        {title && (
          <div className="font-semibold text-body mb-2">
            {title} {hint && <span className="text-neutral-625 font-normal">({hint})</span>}
          </div>
        )}
        {fileInput}
        <div className="border border-neutral-450 rounded-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-[10px] py-[7px] border-b border-neutral-450 bg-neutral-150">
            {toggle}
            <div className="flex items-center gap-2">{action}</div>
          </div>
          {/* Its own row rather than beside the tabs: nine buttons and two
              actions on one line is a wrap on the first narrow viewport. */}
          {mode === 'edit' && <div className="px-[8px] py-[5px] border-b border-neutral-450">{format.toolbar}</div>}
          <div>{body}</div>
        </div>
        {error}
        {mention.panel}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-[10px]">
        {title && <SectionLabel>{title}</SectionLabel>}
        <div className="flex items-center gap-2">
          {toggle}
          {action}
        </div>
      </div>
      {fileInput}
      {mode === 'edit' && <div className="mb-[6px]">{format.toolbar}</div>}
      {body}
      {error}
      {mention.panel}
    </div>
  );
}
