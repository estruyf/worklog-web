// The `#` picker for a Markdown field: type `#` in a description or a note and
// pick the task the reference points at.
//
// A hook rather than a wrapped textarea, because the two fields it serves are
// not the same element — the boxed description editor renders a bare `<textarea>`
// so the frame around it stays one box, while the notes composer uses the
// `TextArea` primitive. The hook hands back props to spread and a panel to
// render; the field stays the call site's own.
//
// What is a mention, and what picking one writes, live in `utils/taskRefs` —
// pure, and tested there. This file is the interaction: caret tracking, the
// keyboard model, and where the panel hangs.

import React from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../../../model/types';
import { useData } from '../../context';
import { applyMention, clientIdOf, isDone, matchTaskRefs, mentionAt } from '../../utils';
import { caretPoint, type CaretPoint } from './caret';

/** Gap between the caret's line and the panel, and the panel's margin from the
 *  viewport edge — the same numbers `Menu` uses, for the same reasons. */
const GAP = 4;
const EDGE = 8;

export interface TaskMentionOptions {
  value: string;
  /** The whole text, with the ref written in. */
  onChange: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** The task being written, which is never a useful thing for it to reference. */
  selfId?: string;
}

export interface TaskMention {
  /** Spread onto the textarea. At a call site with handlers of its own, run
   *  `onKeyDown` first and bail on `defaultPrevented`: an open list owns the
   *  arrows, Enter and Escape, and marks the ones it took. */
  props: {
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onKeyUp: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
    onInput: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
    onClick: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
    onFocus: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
    onBlur: () => void;
    'aria-autocomplete': 'list';
    'aria-controls'?: string;
    'aria-activedescendant'?: string;
  };
  /** Render it anywhere inside the editor; it portals itself to `<body>`. */
  panel: React.ReactNode;
}

export function useTaskMention({ value, onChange, textareaRef, selfId }: TaskMentionOptions): TaskMention {
  const { tasks, statusMeta, clientName } = useData();
  const [caret, setCaret] = React.useState<number | null>(null);
  const [focused, setFocused] = React.useState(false);
  const [active, setActive] = React.useState(0);
  // The `#` the user closed the list on, so Escape stays closed while they keep
  // typing after it. A new `#` — a different offset — is a new question.
  const [dismissed, setDismissed] = React.useState<number | null>(null);
  const [point, setPoint] = React.useState<CaretPoint | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  // Where the caret has to be put back after a pick: React owns the value, so the
  // DOM selection is only ours to set once the new text has been rendered.
  const pendingCaret = React.useRef<number | null>(null);
  const listId = React.useId();

  const mention = React.useMemo(
    () => (focused && caret !== null ? mentionAt(value, caret) : null),
    [focused, caret, value],
  );
  const matches = React.useMemo(
    () => (mention ? matchTaskRefs(tasks, mention.query, selfId) : []),
    [mention, tasks, selfId],
  );
  // Nothing to offer is not a menu: an empty panel over the text would only be in
  // the way, and closing on it is what lets a `#` that was never a reference
  // stop looking like one.
  const open = !!mention && matches.length > 0 && mention.start !== dismissed;

  const syncCaret = React.useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(e.currentTarget.selectionStart);
  }, []);

  React.useEffect(() => {
    setActive(0);
  }, [mention?.query]);

  // The arrows move a painted highlight, not focus — focus never leaves the
  // textarea, so nothing scrolls the list on its own the way a focused option
  // would. Eight matches do not fit in the panel, so without this the keyboard
  // walks off the bottom edge into options nobody can see.
  React.useLayoutEffect(() => {
    if (open) {
      itemRefs.current[active]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, active, matches]);

  // Deleting the `#` back out takes the dismissal with it: the next one typed in
  // the same spot is a new question, not the one that was answered with Escape.
  React.useEffect(() => {
    if (!mention) {
      setDismissed(null);
    }
  }, [mention]);

  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    setPoint(open && el && mention ? caretPoint(el, mention.start) : null);
  }, [open, mention, value, textareaRef]);

  // The panel is placed in viewport coordinates, so anything that moves the field
  // under it would leave it pointing at nothing. `Menu` closes on this; here the
  // list is attached to text that is still being typed, so it follows instead.
  React.useEffect(() => {
    if (!open || !mention) {
      return;
    }
    const onReflow = () => {
      const el = textareaRef.current;
      if (el) {
        setPoint(caretPoint(el, mention.start));
      }
    };
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, mention, textareaRef]);

  // Measured rather than estimated, like `Menu`: how tall the panel is depends on
  // how many tasks matched, and that is what decides whether it fits below the
  // line the caret is on. Hidden until placed, so it never paints at the origin
  // first.
  React.useLayoutEffect(() => {
    const panel = panelRef.current?.getBoundingClientRect();
    if (!point || !panel) {
      setPos(null);
      return;
    }
    const below = point.top + point.height + GAP;
    const top = below + panel.height > window.innerHeight - EDGE ? Math.max(EDGE, point.top - GAP - panel.height) : below;
    const left = Math.max(EDGE, Math.min(point.left, window.innerWidth - EDGE - panel.width));
    setPos({ top, left });
  }, [point, matches.length]);

  React.useLayoutEffect(() => {
    const next = pendingCaret.current;
    const el = textareaRef.current;
    if (next === null || !el) {
      return;
    }
    pendingCaret.current = null;
    el.focus();
    el.setSelectionRange(next, next);
    setCaret(next);
  }, [value, textareaRef]);

  const pick = (task: Task) => {
    if (!mention) {
      return;
    }
    const next = applyMention(value, mention, task.id);
    pendingCaret.current = next.caret;
    setDismissed(null);
    onChange(next.text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) {
      return;
    }
    if (e.key === 'Escape') {
      // Stopped here, or the note editor's own Escape — or the detail panel's, on
      // `window` — would close the thing behind the list instead of the list.
      e.preventDefault();
      e.stopPropagation();
      setDismissed(mention?.start ?? null);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + matches.length) % matches.length);
      return;
    }
    // Tab picks as well as Enter: a mention is a completion, and Tab is what a
    // completion answers to everywhere else.
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const task = matches[active];
      if (task) {
        pick(task);
      }
    }
  };

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        aria-label="Link a task"
        className="fixed z-70 w-[340px] max-w-[calc(100vw-16px)] py-1 bg-white rounded-panel border border-neutral-375 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
      >
        <div className="max-h-[264px] overflow-y-auto">
          {matches.map((task, i) => {
            const done = isDone(task);
            const meta = statusMeta(task.status, done);
            const client = clientName(clientIdOf(task) ?? '');
            return (
              <button
                key={task.id}
                id={`${listId}-${i}`}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                // The field keeps focus through the click: taking it away would
                // move the caret the insertion is measured from.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(task)}
                onMouseEnter={() => setActive(i)}
                className={
                  'w-full flex items-start gap-[9px] px-[11px] py-[7px] border-none cursor-pointer text-left ' +
                  (i === active ? 'bg-neutral-200' : 'bg-transparent')
                }
              >
                <span
                  className="w-[8px] h-[8px] mt-[6px] shrink-0 rounded-full"
                  style={{ background: meta.color }}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className={'block text-control truncate ' + (done ? 'text-neutral-650 line-through' : 'text-neutral-825')}>
                    {task.title}
                  </span>
                  <span className="block text-meta text-neutral-650 mt-[1px] truncate">
                    {client ? `${client} · ` : ''}
                    {meta.name}
                  </span>
                </span>
                <span className="shrink-0 mt-[1px] text-meta text-neutral-625 font-mono">#{task.id}</span>
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );

  return {
    props: {
      onKeyDown,
      onKeyUp: syncCaret,
      // The caret after a keystroke, in the same event that carries the new text:
      // reading it on keyup instead would leave one render seeing new text at the
      // old offset, which is one frame of a list that isn't there yet.
      onInput: syncCaret,
      onClick: syncCaret,
      onFocus: (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        setFocused(true);
        syncCaret(e);
      },
      onBlur: () => setFocused(false),
      // The textarea keeps its own role: it is a Markdown field that happens to
      // complete one token, not a combobox, and re-labelling it as one would
      // rename the whole editor for a screen reader every time a `#` is typed.
      'aria-autocomplete': 'list',
      'aria-controls': open ? listId : undefined,
      'aria-activedescendant': open && matches[active] ? `${listId}-${active}` : undefined,
    },
    panel,
  };
}
