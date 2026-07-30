import React from 'react';
import { CheckIcon, ExternalLinkIcon } from 'lucide-react';
import type { Task } from '../../model/types';
import { linksOf } from '../utils';

export interface CompletedTaskRowProps {
  task: Task;
  onOpen: () => void;
  /** Renders the filled check that puts the task back in play. Omitted where the
   *  list carries a Restore button of its own. */
  onReopen?: () => void;
  /** The resolved status label. Always the done colour — a closed task has one
   *  status, and the column is there to line up with the open lists above it. */
  status?: string;
  /** The one fact the surrounding list doesn't already state: the completion date
   *  in a client's own list, the client in a day's. */
  meta?: React.ReactNode;
  /** Shows the task's first link as an external-link glyph. */
  showLink?: boolean;
  /** Row-level actions, pinned to the end. */
  actions?: React.ReactNode;
}

/** One closed task in a list of them — struck-through title, optional status,
 *  meta and link. Four lists render this row: a client's recently completed, the
 *  archive, the day view's "done today" and the general to-dos. */
export function CompletedTaskRow({ task, onOpen, onReopen, status, meta, showLink, actions }: CompletedTaskRowProps) {
  const link = showLink ? linksOf(task)[0] : undefined;
  return (
    <div className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-225">
      {onReopen && (
        <button
          onClick={onReopen}
          type="button"
          title="Reopen"
          aria-label={`Reopen ${task.title}`}
          className="w-[17px] h-[17px] shrink-0 border-none rounded-full bg-success-500 text-white cursor-pointer p-0 flex items-center justify-center"
        >
          <CheckIcon size={11} strokeWidth={2.5} />
        </button>
      )}
      {status && <span className="w-16 shrink-0 text-status font-bold tracking-status text-success-500">{status}</span>}
      {/* A button rather than a clickable span: three of the four lists rendered
          this as a `<span onClick>`, which no keyboard could reach. */}
      <button
        onClick={onOpen}
        type="button"
        title="Open task"
        className="flex-1 min-w-0 text-left text-row text-neutral-700 line-through decoration-neutral-550 bg-transparent border-none p-0 cursor-pointer hover:underline"
      >
        {task.title}
      </button>
      {meta && <span className="text-control text-neutral-650 shrink-0">{meta}</span>}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          title={link}
          className="text-neutral-625 leading-[0] hover:text-info shrink-0"
        >
          <ExternalLinkIcon size={14} />
        </a>
      )}
      {actions}
    </div>
  );
}
