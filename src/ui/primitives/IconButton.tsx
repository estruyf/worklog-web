import React from 'react';
import { cn } from './cn';

/** `ghost` is the bare glyph used for day/month stepping; `outline` is the boxed
 *  one used where the control has to read as a button against a busy row. */
export type IconButtonVariant = 'ghost' | 'outline';
export type IconButtonSize = 'xs' | 'sm' | 'md';
/** The glyph's colour, independent of the variant's shape. `success` is the
 *  confirmed state of an action that stays in place after it runs — a copy that
 *  landed — where a colour change is the whole feedback. */
export type IconButtonTone = 'neutral' | 'success';

const BASE = 'inline-flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed';

const SIZES: Record<IconButtonSize, string> = {
  xs: 'w-[22px] h-[22px] rounded-control',
  sm: 'w-7 h-7 rounded-control-md',
  md: 'w-8 h-8 rounded-control-md',
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: 'bg-transparent border-none hover:bg-neutral-225 disabled:opacity-40 disabled:hover:bg-transparent',
  outline:
    'border border-neutral-400 bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white',
};

// Kept out of the variants so exactly one `text-*` class is ever emitted: two of
// them would leave the winner to CSS source order, not to the tone asked for.
const TONES: Record<IconButtonTone, string> = {
  neutral: 'text-neutral-700',
  success: 'text-success-600',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  tone?: IconButtonTone;
  /** Required: the button has no text, so this is its only accessible name. */
  'aria-label': string;
}

/** A square, icon-only button. */
export function IconButton({
  variant = 'ghost',
  size = 'md',
  tone = 'neutral',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return <button type={type} className={cn(BASE, SIZES[size], VARIANTS[variant], TONES[tone], className)} {...rest} />;
}
