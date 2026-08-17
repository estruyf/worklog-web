import React from 'react';
import { cn } from './cn';
import {
  CONTROL_BASE,
  CONTROL_INVALID,
  CONTROL_PADDING,
  CONTROL_RADIUS,
  CONTROL_TEXT,
  CONTROL_VARIANTS,
  SHELL_INVALID,
  SHELL_VARIANTS,
  type ControlSize,
  type ControlVariant,
} from './controlStyles';
import { useControlAria } from './Field';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: ControlSize;
  variant?: ControlVariant;
  invalid?: boolean;
  ref?: React.Ref<HTMLTextAreaElement>;
  /** Off for an editor that lives inside a box of its own and must not be
   *  dragged past it. */
  resizable?: boolean;
  /** Grow to fit the text as it is typed, instead of scrolling inside a fixed
   *  height. For the short fields — a note, a comment — where the whole point is
   *  seeing what you wrote. The `min-h-[…]` at the call site stays the floor;
   *  cap the growth with `max-h-[…]` if it needs one. */
  autoGrow?: boolean;
  /** A row above the text, inside the field's frame — a formatting bar. Given
   *  one, this becomes a bordered shell around a transparent textarea, the same
   *  spelling `Input` uses for its adornments and for the same reason: a row of
   *  buttons cannot sit inside a `<textarea>`'s own box. */
  header?: React.ReactNode;
  /** Extra classes for the `<textarea>` itself when a `header` has moved it
   *  inside a shell — the outer `className` styles the shell in that case, so
   *  height (`min-h-[…]`, `max-h-[…]`) belongs here. */
  textareaClassName?: string;
}

/** A multi-line field. Height is layout, so `min-h-[…]` belongs in `className`
 *  at the call site; everything else matches `Input` at the same size. */
export function TextArea({
  size = 'md',
  variant = 'default',
  invalid,
  resizable = true,
  autoGrow = false,
  header,
  className,
  textareaClassName,
  id,
  'aria-describedby': describedBy,
  ref,
  value,
  ...rest
}: TextAreaProps) {
  const aria = useControlAria({ id, describedBy, invalid });
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref],
  );

  // Measure after the DOM has the new text but before paint, so the box is never
  // seen at the wrong height. `auto` first: scrollHeight only reports what the
  // content needs once the element has stopped constraining it. The border is
  // added back because `scrollHeight` stops at the padding edge, and one pixel
  // short is a scrollbar.
  React.useLayoutEffect(() => {
    const el = innerRef.current;
    if (!autoGrow || !el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, [autoGrow, value]);

  const field = (
    <textarea
      ref={setRef}
      value={value}
      id={aria.id}
      aria-describedby={aria.describedBy}
      aria-invalid={aria.invalid || undefined}
      className={cn(
        CONTROL_TEXT[size],
        CONTROL_PADDING[size],
        header
          ? // The shell's border is the focus affordance, so the app-wide
            // `*:focus-visible` outline is suppressed rather than drawn inside it.
            'bg-transparent outline-none focus-visible:outline-none!'
          : cn(CONTROL_BASE, CONTROL_RADIUS[size], aria.invalid ? CONTROL_INVALID : CONTROL_VARIANTS[variant]),
        // A drag handle on a box that re-measures itself on the next keystroke
        // only ever undoes the drag, so `autoGrow` takes the grip away.
        resizable && !autoGrow ? 'resize-y' : 'resize-none',
        header ? textareaClassName : className,
      )}
      {...rest}
    />
  );

  if (!header) {
    return field;
  }

  return (
    <div
      className={cn(
        // `overflow-hidden` so the header's fill stops at the rounded corner.
        'flex flex-col overflow-hidden',
        CONTROL_BASE,
        CONTROL_RADIUS[size],
        aria.invalid ? SHELL_INVALID : SHELL_VARIANTS[variant],
        className,
      )}
    >
      <div className="flex items-center gap-2 px-[8px] py-[5px] border-b border-neutral-450 bg-neutral-150">{header}</div>
      {field}
    </div>
  );
}
