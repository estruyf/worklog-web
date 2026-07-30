import React from 'react';
import { cn } from './cn';

/** A border/background pair rather than a fill: a card framing late work says so
 *  in its border and stays white inside, which is the only way a red card doesn't
 *  read as an error message. */
export type CardTone = 'plain' | 'muted' | 'brand' | 'danger';

/** `list` is what a card wraps a list of rows in — the rows carry the rest.
 *  `md` is the one that holds prose. `none` is for a card whose children run edge
 *  to edge: a header strip, a divided stack. */
export type CardPadding = 'none' | 'list' | 'md';

/** `card` is the box on the page; `panel` is the same box nested *inside* one —
 *  a subtask list, a note, a rendered description — where the outer corner has
 *  already been paid for and repeating it reads as a second frame. */
export type CardRadius = 'card' | 'panel';

const BASE = 'border';

const RADII: Record<CardRadius, string> = {
  card: 'rounded-card',
  panel: 'rounded-panel',
};

const TONES: Record<CardTone, string> = {
  plain: 'border-neutral-375 bg-white',
  muted: 'border-neutral-375 bg-neutral-50',
  brand: 'border-neutral-375 bg-brand-50',
  danger: 'border-danger-200 bg-white',
};

const PADDINGS: Record<CardPadding, string> = {
  none: '',
  list: 'px-2 py-[6px]',
  md: 'px-[18px] py-[14px]',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padding?: CardPadding;
  radius?: CardRadius;
}

/** The app's bordered box. `className` is for what *adds* to the tone — margins,
 *  `overflow-hidden`, `divide-y` — never for a different border, fill or corner;
 *  those are `tone` and `radius`, since `cn` cannot override what they set. */
export function Card({ tone = 'plain', padding = 'none', radius = 'card', className, ...rest }: CardProps) {
  return <div className={cn(BASE, RADII[radius], TONES[tone], PADDINGS[padding], className)} {...rest} />;
}
