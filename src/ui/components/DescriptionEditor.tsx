import React, { useMemo } from 'react';
import { Card, LinkButton, SectionLabel, SegmentedControl, TextArea, cn } from '../primitives';
import { useData } from '../context';
import { useMarkdownImages } from '../hooks';
import { makeImageResolver, renderMarkdown } from '../utils';

/** `boxed` is the task form's editor: the tabs and the image action ride on the
 *  box the two modes swap inside, because that box *is* the field. `inline` is the
 *  detail panel's: the controls sit in the section header beside "Description",
 *  and the preview is a card rather than the inside of a frame. */
export type DescriptionEditorVariant = 'boxed' | 'inline';

export type DescriptionMode = 'edit' | 'preview';

/** The placeholder doubles as the Markdown cheatsheet, which is the reason it
 *  lives here: two copies of it drift, and the one that drifts is the one nobody
 *  is looking at. */
const PLACEHOLDER =
  'Add a description in Markdown…\n\n## Notes\n- supports **bold**, *italic*, `code`\n- [links](https://example.com) or plain https://example.com\n- lists, > quotes\n- paste, drop or add an image';

const MODES: { value: DescriptionMode; label: string }[] = [
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
  onModeChange: (mode: DescriptionMode) => void;
  variant?: DescriptionEditorVariant;
  /** The heading, and the editor's accessible name. It is a heading rather than a
   *  `<label>` on purpose: in preview mode there is no control for it to point at,
   *  and a label pointing at nothing is worse than none. */
  title?: string;
  /** The parenthetical after a `boxed` heading. */
  hint?: string;
  /** Sits after the mode toggle — the detail panel's Save. */
  action?: React.ReactNode;
}

/** Markdown description editor with a write/preview toggle, image paste / drop /
 *  pick, and a click-to-edit empty state. The task form and the task detail panel
 *  both edit a description; this is the one that does it. */
export function DescriptionEditor({
  value,
  onChange,
  mode,
  onModeChange,
  variant = 'inline',
  title = 'Description',
  hint,
  action,
}: DescriptionEditorProps) {
  const { assetUrl } = useData();
  const img = useMarkdownImages(value, onChange);
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);
  const boxed = variant === 'boxed';
  // One height for all three bodies, so switching tabs doesn't resize the page
  // under the pointer. The inline editor sets it on the textarea only — its
  // preview is a card that sizes to its prose.
  const tall = boxed ? 'min-h-[300px] lg:min-h-[420px]' : 'min-h-[280px]';

  const toggle = (
    <SegmentedControl
      aria-label="Description mode"
      variant={boxed ? 'raised' : 'joined'}
      size={boxed ? 'md' : 'sm'}
      options={MODES}
      value={mode}
      onChange={onModeChange}
    />
  );
  const addImage = (
    <LinkButton size={boxed ? 'sm' : 'xs'} onClick={img.openFilePicker} disabled={img.uploading} className="font-medium">
      {img.uploading ? 'Adding…' : '+ Add image'}
    </LinkButton>
  );

  const body =
    mode === 'edit' ? (
      boxed ? (
        // Borderless: the box around it already draws the field, and a second
        // border inside one reads as a frame in a frame.
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={img.onPaste}
          onDrop={img.onDrop}
          onDragOver={img.onDragOver}
          aria-label={title}
          placeholder={PLACEHOLDER}
          className={cn(
            'block w-full px-[14px] py-[12px] text-touch md:text-control-lg leading-[1.6] outline-none focus:outline-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)] resize-y focus-visible:outline-brand-500!',
            tall,
          )}
          style={MONO}
        />
      ) : (
        <TextArea
          size="lg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={img.onPaste}
          onDrop={img.onDrop}
          onDragOver={img.onDragOver}
          aria-label={title}
          placeholder={PLACEHOLDER}
          className={cn('w-full leading-[1.6]', tall)}
          style={MONO}
        />
      )
    ) : value.trim() ? (
      boxed ? (
        <div className={cn('wl-md px-[8px] py-[4px]', tall)} dangerouslySetInnerHTML={{ __html: renderMarkdown(value, resolveImage) }} />
      ) : (
        <Card tone="muted" padding="md" radius="panel" className="wl-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(value, resolveImage) }} />
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
            <div className="flex items-center gap-2">
              {addImage}
              {action}
            </div>
          </div>
          <div>{body}</div>
        </div>
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-[10px]">
        {title && <SectionLabel>{title}</SectionLabel>}
        <div className="flex items-center gap-2">
          {addImage}
          {toggle}
          {action}
        </div>
      </div>
      {fileInput}
      {body}
      {error}
    </div>
  );
}
