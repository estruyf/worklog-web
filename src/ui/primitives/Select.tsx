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

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  variant?: ControlVariant;
  invalid?: boolean;
  ref?: React.Ref<HTMLSelectElement>;
}

/** The native select, wearing the same border, radius and focus treatment as
 *  `Input` at the same size. Native on purpose: the platform's own picker is
 *  what makes a long list usable on a phone. */
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
        aria.invalid ? CONTROL_INVALID : CONTROL_VARIANTS[variant],
        'cursor-pointer',
        className,
      )}
      {...rest}
    />
  );
}
