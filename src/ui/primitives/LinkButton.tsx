import React from 'react';
import { cn } from './cn';

/** `inherit` sets no size of its own, for the ones that sit mid-sentence and have
 *  to match the prose around them. */
export type LinkButtonSize = 'inherit' | 'xs' | 'sm' | 'md' | 'lg';

/** `info` is the blue that reads as a link; `muted` is for the ones that sit in a
 *  section header, where blue would pull more attention than the action deserves.
 *  `danger` covers the destructive text actions. */
export type LinkButtonTone = 'info' | 'muted' | 'danger';

/** No border, no background, no padding: this is a button that reads as a link.
 *  Used for the secondary escape hatches — Clear, Reset, "+ Add another link" —
 *  where a real button would outweigh what it does. */
const BASE =
  'bg-transparent border-none p-0 cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-default disabled:no-underline';

const TONES: Record<LinkButtonTone, string> = {
  info: 'text-info',
  muted: 'text-neutral-675 hover:text-danger-675',
  danger: 'text-danger-675',
};

const SIZES: Record<LinkButtonSize, string> = {
  inherit: '',
  xs: 'text-meta',
  sm: 'text-chip',
  md: 'text-control',
  lg: 'text-control-lg',
};

export interface LinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: LinkButtonSize;
  tone?: LinkButtonTone;
}

export function LinkButton({ size = 'sm', tone = 'info', className, type = 'button', ...rest }: LinkButtonProps) {
  return <button type={type} className={cn(BASE, SIZES[size], TONES[tone], className)} {...rest} />;
}
