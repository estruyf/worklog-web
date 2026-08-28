import React from 'react';
import { cn } from './cn';

/** The three chip families the app actually has, plus the dashed sibling of the
 *  first:
 *
 *  - `select` — one of a set, filled when chosen (a client, a repeat preset).
 *  - `add` — the dashed "+ Add …" that ends such a set. Never selected.
 *  - `filter` — narrows the list below it; several can be on at once.
 *  - `tag` — a label on a row, which *may* also filter when it is clickable.
 */
export type ChipVariant = 'select' | 'add' | 'filter' | 'tag';

const BASE = 'inline-flex items-center gap-[6px] rounded-full border';

const GEOMETRY: Record<ChipVariant, string> = {
  select: 'px-[13px] py-[7px] text-control font-semibold',
  add: 'px-[13px] py-[7px] text-control',
  filter: 'px-[10px] py-[5px] text-chip',
  tag: 'px-[8px] py-[2px] text-eyebrow',
};

const OFF: Record<ChipVariant, string> = {
  select: 'border-neutral-525 bg-neutral-350 text-neutral-825',
  add: 'border-dashed border-neutral-550 bg-white text-neutral-700',
  filter: 'border-neutral-400 bg-white text-neutral-700',
  tag: 'border-neutral-400 bg-neutral-250 text-neutral-725',
};

const ON: Record<ChipVariant, string> = {
  select: 'border-brand-500 bg-brand-450 text-neutral-825',
  add: OFF.add,
  filter: 'border-brand-500 bg-brand-225 text-brand-650 font-semibold',
  tag: 'border-brand-500 bg-brand-225 text-brand-650 font-semibold',
};

/** Only where the chip is a control *and* is not already on — a selected chip
 *  has nowhere left to go, and hovering it should not suggest otherwise. */
const HOVER: Record<ChipVariant, string> = {
  select: 'hover:border-brand-500',
  add: 'hover:border-brand-500 hover:text-brand-800',
  filter: 'hover:border-brand-500',
  tag: 'hover:border-brand-500 hover:bg-brand-175 hover:text-brand-800',
};

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
  /** Leave it out for a chip that is not a toggle — a tag that opens a search
   *  rather than switching a filter on. That is also what decides whether the
   *  button gets an `aria-pressed`, since one that never reports a state has no
   *  business claiming one. */
  selected?: boolean;
  /** `span` for a chip that is only a label — a tag on a row nothing filters by.
   *  It then carries its `title` and nothing else, because there is nothing else
   *  a non-control should be handed. */
  as?: 'button' | 'span';
  /** For a chip in a column of fixed width: it gives up its width when the row
   *  is short of it and ellipsizes its label, rather than keeping its size and
   *  being cut through by the edge of the lane. Everywhere else a chip holds its
   *  width — a filter row wraps instead. */
  truncate?: boolean;
}

/** A rounded label, optionally a control. */
export function Chip({ variant = 'filter', selected, as = 'button', truncate, className, children, ...rest }: ChipProps) {
  const on = selected ?? false;
  const label = truncate ? <span className="truncate">{children}</span> : children;
  const style = cn(
    BASE,
    truncate ? 'min-w-0 max-w-full' : 'shrink-0',
    GEOMETRY[variant],
    on ? ON[variant] : OFF[variant],
    as === 'button' && 'cursor-pointer',
    as === 'button' && !on && HOVER[variant],
    className,
  );
  if (as === 'span') {
    return (
      <span className={style} title={rest.title}>
        {label}
      </span>
    );
  }
  return (
    <button type="button" aria-pressed={selected} className={style} {...rest}>
      {label}
    </button>
  );
}
