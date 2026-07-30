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
}

/** A multi-line field. Height is layout, so `min-h-[…]` belongs in `className`
 *  at the call site; everything else matches `Input` at the same size. */
export function TextArea({
  size = 'md',
  variant = 'default',
  invalid,
  resizable = true,
  className,
  id,
  'aria-describedby': describedBy,
  ...rest
}: TextAreaProps) {
  const aria = useControlAria({ id, describedBy, invalid });
  return (
    <textarea
      id={aria.id}
      aria-describedby={aria.describedBy}
      aria-invalid={aria.invalid || undefined}
      className={cn(
        CONTROL_BASE,
        CONTROL_GEOMETRY[size],
        CONTROL_TEXT[size],
        aria.invalid ? CONTROL_INVALID : CONTROL_VARIANTS[variant],
        resizable ? 'resize-y' : 'resize-none',
        className,
      )}
      {...rest}
    />
  );
}
