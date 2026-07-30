import React from 'react';
import { cn } from './cn';

/** `md` is the eyebrow over a block of the page; `sm` is the one squeezed into a
 *  rail or a dropdown. */
export type SectionLabelSize = 'sm' | 'md';

/** `danger` is for the one block that is a warning in itself — overdue work. */
export type SectionLabelTone = 'muted' | 'danger';

/** `uppercase` lives here rather than in the text, so a label can be written the
 *  way it should be read aloud and still render as an eyebrow.
 *
 *  Block-level `flex` rather than `inline-flex`: a label standing on its own line
 *  would otherwise sit in a line box sized by the *parent's* font, adding a few
 *  px under every one of them. Inside a flex row it is a flex item either way. */
const BASE = 'flex items-center gap-[6px] font-bold uppercase tracking-eyebrow';

const SIZES: Record<SectionLabelSize, string> = {
  sm: 'text-status',
  md: 'text-eyebrow',
};

const TONES: Record<SectionLabelTone, string> = {
  muted: 'text-neutral-675',
  danger: 'text-danger-675',
};

export interface SectionLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SectionLabelSize;
  tone?: SectionLabelTone;
}

/** The small capitalised label that names a block of the page. Not a heading: it
 *  titles a region of an existing one, and the app's `h1` is the view. */
export function SectionLabel({ size = 'md', tone = 'muted', className, ...rest }: SectionLabelProps) {
  return <span className={cn(BASE, SIZES[size], TONES[tone], className)} {...rest} />;
}
