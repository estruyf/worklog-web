import React from 'react';
import { cn } from './cn';

/** `ghost` is the bare glyph used for day/month stepping; `outline` is the boxed
 *  one used where the control has to read as a button against a busy row. */
export type IconButtonVariant = 'ghost' | 'outline';
export type IconButtonSize = 'xs' | 'sm' | 'md';

const BASE = 'inline-flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed';

const SIZES: Record<IconButtonSize, string> = {
  xs: 'w-[22px] h-[22px] rounded-md',
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-8 h-8 rounded-lg',
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    'bg-transparent border-none text-neutral-700 hover:bg-neutral-225 disabled:opacity-40 disabled:hover:bg-transparent',
  outline:
    'border border-neutral-400 bg-white text-neutral-700 hover:bg-neutral-200 disabled:opacity-40 disabled:hover:bg-white',
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Required: the button has no text, so this is its only accessible name. */
  'aria-label': string;
}

/** A square, icon-only button. */
export function IconButton({
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return <button type={type} className={cn(BASE, SIZES[size], VARIANTS[variant], className)} {...rest} />;
}
