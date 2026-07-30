import React from 'react';
import { cn } from '../primitives';

export interface ClientListItemProps {
  name: string;
  color: string;
  /** Open tasks, shown at the end of the row. */
  count: number;
  active?: boolean;
  /** An archived client: still openable, faded so the list reads as history. */
  dimmed?: boolean;
  title?: string;
  onClick: () => void;
  /** Layout only — the width and the gap between rows, which belong to the list
   *  rather than to the row. */
  className?: string;
}

/** One selectable client: colour dot, name, open-task count. The Clients view
 *  renders this four times over — desktop and mobile, active and archived — and
 *  the only thing that changes between them is `dimmed`. */
export function ClientListItem({ name, color, count, active, dimmed, title, onClick, className }: ClientListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      // Selection, not navigation: `aria-current` is what says which one of a set
      // of siblings you are on, and these rows had nothing saying it at all.
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-[10px] rounded-lg border-none cursor-pointer text-left',
        active ? 'bg-brand-225' : 'bg-transparent hover:bg-neutral-200',
        className,
      )}
    >
      <span className={cn('flex items-center gap-[9px] min-w-0', dimmed && 'opacity-65')}>
        <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: color }} />
        <span className="font-semibold text-body truncate">{name}</span>
      </span>
      <span className="text-neutral-625 text-control shrink-0">{count}</span>
    </button>
  );
}
