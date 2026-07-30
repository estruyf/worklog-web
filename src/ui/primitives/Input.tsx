import React from 'react';
import { cn } from './cn';
import {
  CONTROL_BASE,
  CONTROL_GEOMETRY,
  CONTROL_INVALID,
  CONTROL_TEXT,
  CONTROL_VARIANTS,
  SHELL_INVALID,
  SHELL_VARIANTS,
  type ControlSize,
  type ControlVariant,
} from './controlStyles';
import { useControlAria } from './Field';

/** Same glyph as `Icon name="close"`, inlined so the primitives stay free of
 *  imports from `components/`. */
const CLOSE_PATH =
  'M8 6.94 11.06 3.88l1.06 1.06L9.06 8l3.06 3.06-1.06 1.06L8 9.06l-3.06 3.06-1.06-1.06L6.94 8 3.88 4.94l1.06-1.06L8 6.94Z';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
  variant?: ControlVariant;
  /** Overrides whatever an enclosing `Field` says. A `Field` with an `error`
   *  already marks its control invalid, so this is for a control standing alone. */
  invalid?: boolean;
  ref?: React.Ref<HTMLInputElement>;
  /** Adornment before the text — a search glyph, a currency symbol. */
  leading?: React.ReactNode;
  /** Adornment after the text, before the clear button. */
  trailing?: React.ReactNode;
  /** Shows a `×` at the far right once the field has a value. */
  clearable?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  /** Extra classes for the `<input>` itself when adornments have moved it inside
   *  a shell — the outer `className` styles the shell in that case. */
  inputClassName?: string;
}

/** A single-line text field.
 *
 *  With no adornments this is one `<input>` carrying the border. Give it a
 *  `leading`/`trailing` node or `clearable` and it becomes a bordered shell
 *  around a transparent input instead, because a `×` cannot sit inside an
 *  `<input>`'s own box. Both spellings use the same geometry and the same focus
 *  treatment, so the two look identical side by side. */
export function Input({
  size = 'md',
  variant = 'default',
  invalid,
  leading,
  trailing,
  clearable,
  onClear,
  clearLabel = 'Clear',
  className,
  inputClassName,
  id,
  'aria-describedby': describedBy,
  ...rest
}: InputProps) {
  const aria = useControlAria({ id, describedBy, invalid });
  const shared = {
    id: aria.id,
    'aria-describedby': aria.describedBy,
    'aria-invalid': aria.invalid || undefined,
    ...rest,
  };

  if (!leading && !trailing && !clearable) {
    return (
      <input
        className={cn(
          CONTROL_BASE,
          CONTROL_GEOMETRY[size],
          CONTROL_TEXT[size],
          aria.invalid ? CONTROL_INVALID : CONTROL_VARIANTS[variant],
          className,
        )}
        {...shared}
      />
    );
  }

  const showClear = clearable && !!rest.value;
  return (
    <div
      className={cn(
        'flex items-center gap-[10px]',
        CONTROL_BASE,
        CONTROL_GEOMETRY[size],
        aria.invalid ? SHELL_INVALID : SHELL_VARIANTS[variant],
        className,
      )}
    >
      {leading}
      {/* The shell's border is the focus affordance, so the app-wide
          `*:focus-visible` outline is suppressed rather than drawn inside it. */}
      <input
        className={cn(
          'flex-1 min-w-0 bg-transparent outline-none focus-visible:outline-none!',
          CONTROL_TEXT[size],
          inputClassName,
        )}
        {...shared}
      />
      {trailing}
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={clearLabel}
          className="shrink-0 text-muted hover:text-fg cursor-pointer"
        >
          <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d={CLOSE_PATH} />
          </svg>
        </button>
      )}
    </div>
  );
}
