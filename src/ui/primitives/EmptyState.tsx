import React from 'react';
import { cn } from './cn';

/** `sm` for the one that sits inside a card or a rail, `md` for the one standing
 *  in for a whole block of the page. */
export type EmptyStateSize = 'sm' | 'md';

/** Italic and grey: the app says "there is nothing here" in a voice that is
 *  plainly the app's own rather than a row that happens to be blank. */
const BASE = 'text-neutral-625 italic';

const SIZES: Record<EmptyStateSize, string> = {
  sm: 'text-control',
  md: 'text-body',
};

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: EmptyStateSize;
}

/** The line that stands where a list would be. `className` carries the spacing,
 *  since what an empty state is nested in decides that, not the state itself. */
export function EmptyState({ size = 'md', className, ...rest }: EmptyStateProps) {
  return <div className={cn(BASE, SIZES[size], className)} {...rest} />;
}
