import React from 'react';
import { cn } from './cn';
import { Input, type InputProps } from './Input';

export type DateInputProps = Omit<InputProps, 'type' | 'leading' | 'trailing' | 'clearable' | 'onClear'>;

/** `<input type="date">` with the app's field styling.
 *
 *  `min-w-0` is baked in because a native date input placed in a flex row
 *  refuses to shrink below its intrinsic width and pushes the row wider instead;
 *  it still clips its own text below roughly 150px, so a narrow column wants
 *  `min-w-[150px]` on the wrapper and a wrap rather than a squeeze.
 *
 *  No `clearable`: a date field's clear belongs next to the label — pass it as a
 *  `Field` `action` — because the native control already owns the right-hand
 *  edge of its own box for the picker glyph. */
export function DateInput({ className, ...rest }: DateInputProps) {
  return <Input type="date" className={cn('min-w-0', className)} {...rest} />;
}
