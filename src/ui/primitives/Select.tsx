import React from 'react';
import { cn } from './cn';
import {
  CONTROL_BASE,
  CONTROL_GEOMETRY,
  CONTROL_INVALID,
  CONTROL_TEXT,
  CONTROL_VARIANTS,
  SELECT_CHEVRON,
  type ControlSize,
  type ControlVariant,
} from './controlStyles';
import { useControlAria } from './Field';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  variant?: ControlVariant;
  invalid?: boolean;
  ref?: React.Ref<HTMLSelectElement>;
}

/** The native select, wearing the same border, radius and focus treatment as
 *  `Input` at the same size. Native on purpose: the platform's own picker is
 *  what makes a long list usable on a phone.
 *
 *  The *element* is native; its box is not. Left to itself a `<select>` keeps
 *  drawing the platform's chrome over these styles — iOS in particular renders
 *  a grey pill with centred text and no arrow, which is why the filters read as
 *  dead boxes in the installed app — so `select-chevron` strips the appearance
 *  and paints the arrow back. Both halves live in that one utility: stripping
 *  the appearance is also what removes the platform's own arrow, so a select
 *  can't end up with neither. */
export function Select({
  size = 'md',
  variant = 'default',
  invalid,
  className,
  id,
  'aria-describedby': describedBy,
  ...rest
}: SelectProps) {
  const aria = useControlAria({ id, describedBy, invalid });
  return (
    <select
      id={aria.id}
      aria-describedby={aria.describedBy}
      aria-invalid={aria.invalid || undefined}
      className={cn(
        CONTROL_BASE,
        CONTROL_GEOMETRY[size],
        CONTROL_TEXT[size],
        SELECT_CHEVRON[size],
        // The hover only rides along with the resting variants: an invalid
        // control has to keep reading as invalid under the pointer.
        aria.invalid ? CONTROL_INVALID : cn(CONTROL_VARIANTS[variant], 'hover:border-neutral-600'),
        // `max-w-full` because a select is as wide as its widest option: one
        // long client name would otherwise push a toolbar past the viewport on
        // a phone. Constrained, the browser ellipsises the label instead.
        'select-chevron max-w-full cursor-pointer',
        className,
      )}
      {...rest}
    />
  );
}
