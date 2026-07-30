import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';

/** `numbers` is the full stepper for a list long enough that "which page am I on"
 *  is a real question. `compact` is the three-part one that fits inside a card:
 *  back, "2 / 5", forward. */
export type PagerVariant = 'numbers' | 'compact';

const STEP =
  'inline-flex items-center justify-center min-w-[32px] h-8 px-[9px] border rounded-control text-control font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default';
const STEP_IDLE = 'border-neutral-400 bg-white text-neutral-750 hover:bg-neutral-200 disabled:hover:bg-white';
const STEP_CURRENT = 'border-brand-500 bg-brand-225 text-brand-650';

export interface PagerProps {
  /** 1-based, so `page` reads the same as what the buttons show. */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  variant?: PagerVariant;
  /** The page numbers to offer, `null` standing for an elided run. Required by
   *  `numbers`; the windowing itself is the caller's, since how much of a long
   *  list is worth showing is a decision about that list. */
  pages?: (number | null)[];
  /** Also the arrows' tooltips — a stepper inside a card is stepping through that
   *  card's list, not the page. */
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}

/** Previous / next around either a window of page numbers or a "n / m" count. */
export function Pager({
  page,
  pageCount,
  onPage,
  variant = 'numbers',
  pages,
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  className,
}: PagerProps) {
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center justify-between gap-2', className)}>
        <IconButton
          variant="outline"
          size="xs"
          onClick={() => onPage(page - 1)}
          disabled={atStart}
          title={previousLabel}
          aria-label={previousLabel}
        >
          <ChevronLeftIcon size={13} />
        </IconButton>
        <span className="text-meta text-neutral-675 tabular-nums">
          {page} / {pageCount}
        </span>
        <IconButton
          variant="outline"
          size="xs"
          onClick={() => onPage(page + 1)}
          disabled={atEnd}
          title={nextLabel}
          aria-label={nextLabel}
        >
          <ChevronRightIcon size={13} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-[5px]', className)}>
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={atStart}
        aria-label={previousLabel}
        className={cn(STEP, STEP_IDLE)}
      >
        <ChevronLeftIcon size={15} />
      </button>
      {(pages ?? []).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-control text-neutral-625">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(STEP, p === page ? STEP_CURRENT : STEP_IDLE)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={atEnd}
        aria-label={nextLabel}
        className={cn(STEP, STEP_IDLE)}
      >
        <ChevronRightIcon size={15} />
      </button>
    </div>
  );
}
