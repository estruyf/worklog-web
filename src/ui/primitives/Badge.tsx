import React from 'react';
import { cn } from './cn';

/** `neutral` is a plain count. `outline` is a state the reader should notice but
 *  not worry about ("archived"). `brand` and `danger` are the two that mean
 *  something — work in progress, and work that is late. */
export type BadgeTone = 'neutral' | 'outline' | 'brand' | 'danger';

/** `xs` sits beside a group name inside a list, `sm` in a nav row, `md` beside a
 *  section label. */
export type BadgeSize = 'xs' | 'sm' | 'md';

/** `min-w` plus centring is what makes a one-digit count a circle and a longer
 *  one a pill, from the same class. */
const BASE = 'inline-flex items-center justify-center shrink-0 rounded-full font-semibold';

const SIZES: Record<BadgeSize, string> = {
  xs: 'min-w-[18px] h-[18px] px-[6px] text-eyebrow',
  sm: 'min-w-5 h-5 px-[7px] text-count',
  md: 'min-w-5 h-5 px-[7px] text-meta',
};

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-325 text-neutral-675',
  outline: 'bg-neutral-250 border border-neutral-400 text-neutral-675',
  brand: 'bg-brand-225 border border-brand-350 text-brand-650',
  danger: 'bg-danger-100 border border-danger-200 text-danger-675',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
}

/** The pill that carries a count, or a one-word state, next to a label. */
export function Badge({ tone = 'neutral', size = 'md', className, ...rest }: BadgeProps) {
  return <span className={cn(BASE, SIZES[size], TONES[tone], className)} {...rest} />;
}
