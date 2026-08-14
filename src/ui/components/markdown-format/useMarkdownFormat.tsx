// The formatting bar for a Markdown field, and the shortcuts that do the same
// things without it: ⌘B, ⌘I, ⌘E, ⌘K, and Enter carrying a list marker onto the
// next line.
//
// A hook rather than a wrapped textarea, for the same reason `../task-mention`
// is one: the fields it serves are not the same element, and the toolbar sits in
// a different place in each of them. The hook hands back props to spread and a
// toolbar to render; where that toolbar goes stays the call site's own.
//
// What each button does to the text lives in `utils/markdownEdit` — pure, and
// tested there. This file is the interaction: reading the caret, and putting the
// selection back once React has rendered the new text.

import React from 'react';
import { BoldIcon, CodeIcon, ImagePlusIcon, ItalicIcon, LinkIcon, ListIcon, ListOrderedIcon, ListTodoIcon, QuoteIcon, StrikethroughIcon } from 'lucide-react';
import { IconButton } from '../../primitives';
import { MOD_KEY, continueList, insertLink, toggleLinePrefix, toggleWrap } from '../../utils';
import type { MarkdownEdit } from '../../utils';

type Edit = (text: string, start: number, end: number) => MarkdownEdit;

interface Action {
  label: string;
  /** The chord shown after the label, without the modifier. */
  chord?: string;
  Icon: typeof BoldIcon;
  run: Edit;
}

/** Inline first, then block — the same split the bar draws a divider on. */
const INLINE: Action[] = [
  { label: 'Bold', chord: 'B', Icon: BoldIcon, run: (t, s, e) => toggleWrap(t, s, e, '**') },
  { label: 'Italic', chord: 'I', Icon: ItalicIcon, run: (t, s, e) => toggleWrap(t, s, e, '*') },
  { label: 'Strikethrough', chord: '⇧X', Icon: StrikethroughIcon, run: (t, s, e) => toggleWrap(t, s, e, '~~') },
  { label: 'Code', chord: 'E', Icon: CodeIcon, run: (t, s, e) => toggleWrap(t, s, e, '`') },
  { label: 'Link', chord: 'K', Icon: LinkIcon, run: insertLink },
];

const BLOCK: Action[] = [
  { label: 'Bulleted list', chord: '⇧8', Icon: ListIcon, run: (t, s, e) => toggleLinePrefix(t, s, e, 'bullet') },
  { label: 'Numbered list', chord: '⇧7', Icon: ListOrderedIcon, run: (t, s, e) => toggleLinePrefix(t, s, e, 'ordered') },
  { label: 'Task list', Icon: ListTodoIcon, run: (t, s, e) => toggleLinePrefix(t, s, e, 'task') },
  { label: 'Quote', Icon: QuoteIcon, run: (t, s, e) => toggleLinePrefix(t, s, e, 'quote') },
];

/** ⌘B and friends, by the letter as typed. `⇧` ones are matched on `code` so a
 *  non-US layout, where ⇧8 is not `*`, still reaches them. */
const KEYS: Record<string, Edit> = {
  b: INLINE[0].run,
  i: INLINE[1].run,
  e: INLINE[3].run,
  k: INLINE[4].run,
};
const SHIFT_KEYS: Record<string, Edit> = {
  KeyX: INLINE[2].run,
  Digit8: BLOCK[0].run,
  Digit7: BLOCK[1].run,
};

export interface MarkdownFormatOptions {
  value: string;
  /** The whole text, formatted. */
  onChange: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Adds an image button to the bar, for a field that takes them. The upload
   *  itself stays at the call site — it needs the text and a file input, neither
   *  of which is this hook's business, and paste and drop go through it too. */
  image?: { onAdd: () => void; busy?: boolean };
}

export interface MarkdownFormat {
  /** Spread onto the textarea, or chained after another `onKeyDown`: like the
   *  `#` picker's, this one bails on an event something else already took. */
  props: {
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  };
  /** The button row. Render it above the field; it brings no spacing of its own. */
  toolbar: React.ReactNode;
}

export function useMarkdownFormat({ value, onChange, textareaRef, image }: MarkdownFormatOptions): MarkdownFormat {
  // Where the selection has to be put back after an edit: React owns the value,
  // so the DOM selection is only ours to set once the new text has rendered.
  const pending = React.useRef<[number, number] | null>(null);

  React.useLayoutEffect(() => {
    const next = pending.current;
    const el = textareaRef.current;
    if (!next || !el) {
      return;
    }
    pending.current = null;
    el.focus();
    el.setSelectionRange(next[0], next[1]);
  }, [value, textareaRef]);

  const apply = React.useCallback(
    (edit: Edit) => {
      const el = textareaRef.current;
      if (!el) {
        return;
      }
      const next = edit(value, el.selectionStart, el.selectionEnd);
      if (!next) {
        return;
      }
      // An edit that changes only the selection renders nothing, so the effect
      // above would never fire — and the offsets would then be applied to
      // whatever the *next* keystroke typed.
      if (next.text === value) {
        el.setSelectionRange(next.start, next.end);
        return;
      }
      pending.current = [next.start, next.end];
      onChange(next.text);
    },
    [value, onChange, textareaRef],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // The `#` picker owns Enter while its list is open, and marks it handled.
    if (e.defaultPrevented || e.altKey) {
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      const run = e.shiftKey ? SHIFT_KEYS[e.code] : KEYS[e.key.toLowerCase()];
      if (run) {
        // ⌘B is "bookmarks" in some browsers and ⌘I "page info" in others;
        // neither is what a field being typed in means by it.
        e.preventDefault();
        apply(run);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const el = e.currentTarget;
      if (el.selectionStart !== el.selectionEnd) {
        return;
      }
      const next = continueList(value, el.selectionStart);
      if (next) {
        e.preventDefault();
        apply(() => next);
      }
    }
  };

  const button = ({ label, chord, Icon, run }: Action) => (
    <IconButton
      key={label}
      size="xs"
      aria-label={label}
      title={chord ? `${label} (${MOD_KEY}${chord})` : label}
      // The field keeps focus through the click: taking it away would lose the
      // selection the edit is measured from.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => apply(run)}
    >
      <Icon size={14} aria-hidden="true" />
    </IconButton>
  );

  const divider = <span className="w-px h-[16px] mx-[5px] bg-neutral-450" aria-hidden="true" />;

  const toolbar = (
    // Not `role="toolbar"`: that promises arrow-key navigation between the
    // buttons, and the arrows here belong to the text.
    <div className="flex flex-wrap items-center gap-[1px]">
      {INLINE.map(button)}
      {divider}
      {BLOCK.map(button)}
      {image && (
        <>
          {divider}
          <IconButton
            size="xs"
            aria-label="Add image"
            // No spinner, but the button is out of action and says so: an upload
            // that has not landed yet is not a second thing to start.
            title={image.busy ? 'Adding image…' : 'Add image'}
            disabled={image.busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={image.onAdd}
          >
            <ImagePlusIcon size={14} aria-hidden="true" />
          </IconButton>
        </>
      )}
    </div>
  );

  return { props: { onKeyDown }, toolbar };
}
