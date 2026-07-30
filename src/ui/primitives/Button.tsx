import React from 'react';
import { cn } from './cn';

/** The app's button tones. Each one owns its own disabled treatment, because the
 *  right "off" look differs: a primary action greys into the brand's inert pair,
 *  while a secondary one only loses its text colour and hover. */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'danger'
  | 'dangerSolid'
  | 'success'
  | 'dashed'
  | 'ghost';

/** Four steps, taken from what the app already used: `xs` for the actions that
 *  appear on a task row, `sm` for a toolbar cluster, `md` for a standalone action,
 *  `lg` for the confirm/cancel pair at the bottom of a dialog or form. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-[6px] border cursor-pointer whitespace-nowrap disabled:cursor-not-allowed';

const SIZES: Record<ButtonSize, string> = {
  xs: 'px-2 py-[5px] rounded-control text-meta font-medium',
  sm: 'px-[14px] py-[7px] rounded-control text-control font-semibold',
  md: 'px-[14px] py-[9px] rounded-control-md text-control font-semibold',
  lg: 'px-5 py-[10px] rounded-control-lg text-body font-semibold',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475 disabled:border-brand-375 disabled:bg-brand-175 disabled:text-brand-550 disabled:hover:bg-brand-175',
  secondary:
    'border-neutral-400 bg-white text-neutral-750 hover:bg-neutral-200 disabled:text-neutral-625 disabled:hover:bg-white',
  neutral:
    'border-neutral-400 bg-neutral-250 text-neutral-825 hover:bg-neutral-300 disabled:opacity-50 disabled:hover:bg-neutral-250',
  danger:
    'border-danger-225 bg-white text-danger-675 hover:bg-danger-75 disabled:opacity-50 disabled:hover:bg-white',
  dangerSolid:
    'border-danger-675 bg-danger-675 text-white hover:bg-danger-700 hover:border-danger-700 disabled:opacity-50',
  success:
    'border-success-175 bg-success-100 text-success-625 hover:bg-success-125 disabled:opacity-50 disabled:hover:bg-success-100',
  dashed:
    'border-dashed border-neutral-550 bg-white text-neutral-700 hover:border-brand-500 hover:text-brand-800 disabled:opacity-50',
  ghost:
    'border-transparent bg-transparent text-neutral-750 hover:bg-neutral-200 disabled:opacity-50 disabled:hover:bg-transparent',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A text (optionally icon + text) button. `className` is for layout only —
 *  margins, `w-full`, `flex-1`, `shrink-0`; see the note on `cn`. */
export function Button({ variant = 'secondary', size = 'sm', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn(BASE, SIZES[size], VARIANTS[variant], className)} {...rest} />;
}
