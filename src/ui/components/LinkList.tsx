import React from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import type { TaskLink } from '../../model/types';
import { CopyButton } from './CopyButton';

export interface LinkListProps {
  links: TaskLink[];
  /** Layout only — margins and indentation from the surface that owns the list. */
  className?: string;
}

/** The read-only rendering of a `TaskLink[]` — a task's issue links, a client's
 *  reference links — as an opening anchor plus a copy button per row.
 *
 *  One component for all three surfaces because the copy affordance is the point:
 *  a link that only opens forces the browser's context menu on anyone who wants
 *  the URL itself (pasting it into a commit message, a chat, a ticket).
 *
 *  The label is truncated rather than wrapped, with the full URL in `title`. A row
 *  is one line high everywhere, and the whole URL is a click away on the button,
 *  which is what a wrapped 200-character tracker link was standing in for. */
export function LinkList({ links, className }: LinkListProps) {
  if (links.length === 0) {
    return null;
  }
  return (
    <div className={'flex flex-col gap-1 min-w-0 ' + (className ?? '')}>
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-[2px] min-w-0">
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer noopener"
            title={l.url}
            className="flex items-center gap-[7px] min-w-0 text-control-lg text-info hover:underline"
          >
            <ExternalLinkIcon size={14} className="shrink-0" />
            <span className="truncate">{l.label || l.url}</span>
          </a>
          <CopyButton value={l.url} label={`Copy link ${l.label || l.url}`} />
        </div>
      ))}
    </div>
  );
}
