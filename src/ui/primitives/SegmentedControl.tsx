import React from 'react';
import { cn } from './cn';

/** `raised` is the filter switch that sits in a toolbar: segments float on an
 *  inset track, and the chosen one is the white card. `joined` is the tighter
 *  pair that sits on a control it belongs to — Preview/Edit on an editor — where
 *  a track would read as a second toolbar. */
export type SegmentedVariant = 'raised' | 'joined';
export type SegmentedSize = 'sm' | 'md';

const TRACKS: Record<SegmentedVariant, string> = {
  raised: 'inline-flex p-[2px] rounded-control-md bg-neutral-250 border border-neutral-400',
  joined: 'inline-flex w-fit rounded-control border border-neutral-400 overflow-hidden',
};

const ITEM_BASE = 'cursor-pointer whitespace-nowrap';

const ITEMS: Record<SegmentedVariant, Record<SegmentedSize, string>> = {
  raised: {
    sm: 'px-[10px] py-[4px] rounded-chip text-meta',
    md: 'px-[11px] py-[5px] rounded-chip text-chip',
  },
  joined: {
    sm: 'px-[10px] py-[4px] text-meta',
    md: 'px-[12px] py-[6px] text-chip',
  },
};

const ON: Record<SegmentedVariant, string> = {
  raised: 'bg-white text-neutral-825 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
  joined: 'bg-brand-225 text-brand-800 font-semibold',
};

const OFF: Record<SegmentedVariant, string> = {
  raised: 'text-neutral-675 font-medium hover:text-neutral-825',
  joined: 'bg-white text-neutral-700 hover:bg-neutral-150',
};

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** The tooltip, and the place to say what the segment actually changes when the
   *  label is too short to. */
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: SegmentedVariant;
  size?: SegmentedSize;
  /** Names the group. Required: read one segment at a time, "All" and "Open" say
   *  nothing about what they are switching. */
  'aria-label': string;
  className?: string;
}

/** A row of mutually exclusive buttons, exactly one of them on. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'raised',
  size = 'md',
  'aria-label': label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn(TRACKS[variant], className)}>
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              ITEM_BASE,
              ITEMS[variant][size],
              active ? ON[variant] : OFF[variant],
              // The rule between two joined segments, drawn once rather than on
              // both sides of it.
              variant === 'joined' && i > 0 && 'border-l border-neutral-400',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
