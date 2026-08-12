import React from 'react';
import { cn } from './cn';

export interface ViewHeaderProps {
  children: React.ReactNode;
  /** Added to the row inside the band: the view's own column width and layout.
   *  Additive only — the band's own gutter and padding are not overridable (see
   *  `cn`), which is the point: every view's header is the same band. */
  className?: string;
}

/** A view's top row — its title and the actions that belong to the whole view —
 *  in a band above that view's scroll area.
 *
 *  It sits *outside* the scrolling element rather than being `sticky` inside it.
 *  Sticky would work too, but then anything a view wants to pin inside its own
 *  content (the Day view's to-do rail) would have to know how tall this is, and
 *  a header that wraps to two rows on a phone would leave that number wrong.
 *  Out here the offset is zero and stays zero.
 *
 *  Style only: what goes in the band is the view's business. The centred column
 *  is passed in, because the one view whose content is full width (the clients
 *  pane) needs its header to be full width too. */
export function ViewHeader({ children, className }: ViewHeaderProps) {
  return (
    <div className="shrink-0 border-b border-neutral-375 bg-white px-6 py-4">
      <div className={cn('mx-auto w-full', className)}>{children}</div>
    </div>
  );
}
