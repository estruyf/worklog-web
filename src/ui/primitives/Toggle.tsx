import React from 'react';
import { cn } from './cn';

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Required: the track has no text, so this is its only accessible name. Pass
   *  `aria-labelledby` through `rest` instead where the setting's own title is
   *  already on screen. */
  'aria-label': string;
}

/** An on/off switch. A `<button role="switch">` rather than a checkbox: the
 *  visible control is a track and a knob, and `aria-checked` is what says which
 *  way it is pointing. */
export function Toggle({ checked, onChange, className, ...rest }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 w-[42px] h-[24px] rounded-full border transition-colors cursor-pointer',
        checked ? 'bg-brand-450 border-brand-500' : 'bg-neutral-400 border-neutral-525',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all',
          checked ? 'left-[21px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}
