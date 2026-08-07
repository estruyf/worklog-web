import React from 'react';
import { cn } from './cn';
import {
  CONTROL_BASE,
  CONTROL_GEOMETRY,
  CONTROL_INVALID,
  CONTROL_TEXT,
  CONTROL_VARIANTS,
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
}

/** A multi-line field. Height is layout, so `min-h-[…]` belongs in `className`
 *  at the call site; everything else matches `Input` at the same size. */
export function TextArea({
  size = 'md',
  variant = 'default',
  invalid,
  resizable = true,
  autoGrow = false,
  className,
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

  return (
    <textarea
      ref={setRef}
      value={value}
      id={aria.id}
      aria-describedby={aria.describedBy}
      aria-invalid={aria.invalid || undefined}
      className={cn(
        CONTROL_BASE,
        CONTROL_GEOMETRY[size],
        CONTROL_TEXT[size],
        aria.invalid ? CONTROL_INVALID : CONTROL_VARIANTS[variant],
        // A drag handle on a box that re-measures itself on the next keystroke
        // only ever undoes the drag, so `autoGrow` takes the grip away.
        resizable && !autoGrow ? 'resize-y' : 'resize-none',
        className,
      )}
      {...rest}
    />
  );
}
