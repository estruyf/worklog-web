import React from 'react';
import type { MonthlyRow } from '../../model';
import { Card, cn, EmptyState, LinkButton } from '../../primitives';
import { CopyButton } from '../../components';

// One column string for the header, the rows and the total, so the three can
// never drift out of alignment with each other.
const COLUMNS = 'grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px]';

export interface HoursTableProps {
  /** What the first column names — "Client" or "Event". Shown uppercased. */
  heading: string;
  rows: MonthlyRow[];
  totalLabel: string;
  totalHours: number;
  /** Pre-formatted by `num`, the same as each row's — "7.5", not 7.5. */
  totalDays: string;
  onOpenDate: (date: string) => void;
  /** Stands in for the rows when there are none; omit to show nothing at all. */
  empty?: string;
  className?: string;
}

/** The month's hours broken down by client or by event: a row each, every logged
 *  date linking into that day, and a total that shows even when the body is empty
 *  — a month with nothing in it is a fact about the month, not a missing table. */
export function HoursTable({ heading, rows, totalLabel, totalHours, totalDays, onOpenDate, empty, className }: HoursTableProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className={cn(COLUMNS, 'py-3 bg-neutral-150 border-b border-neutral-375 text-eyebrow font-bold tracking-eyebrow text-neutral-675')}>
        <span>{heading.toUpperCase()}</span>
        <span className="text-right">HOURS</span>
        <span className="text-right">DAYS</span>
        <span className="pl-[14px]">DATES</span>
      </div>

      {rows.map((r, i) => (
        <div key={i} className={cn(COLUMNS, 'py-[13px] border-b border-neutral-275 items-center text-body')}>
          <span className="flex items-center gap-[9px]">
            <span className="w-[9px] h-[9px] rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="text-right tabular-nums">{r.hours}</span>
          <span className="text-right tabular-nums">{r.days}</span>
          <div className="pl-[14px] flex items-start gap-2">
            {/* Inline flow, not flex: flex items are blockified, and a copy of a
                flexed list comes out one date per line. Inline keeps it one line. */}
            <div className="flex-1 min-w-0 leading-[1.7]">
              {r.dates.map((d, idx) => (
                <React.Fragment key={d.date}>
                  <LinkButton size="inherit" onClick={() => onOpenDate(d.date)} className="tabular-nums align-baseline">
                    {d.label}
                  </LinkButton>
                  {idx < r.dates.length - 1 && <span className="text-neutral-675">{', '}</span>}
                </React.Fragment>
              ))}
            </div>
            {r.dates.length > 0 && <CopyButton value={r.dates.map((d) => d.label).join(', ')} label={`Copy ${r.name} dates`} className="mt-px" />}
          </div>
        </div>
      ))}

      {rows.length === 0 && empty && <EmptyState className="px-[18px] py-[13px]">{empty}</EmptyState>}

      <div className={cn(COLUMNS, 'py-[13px] bg-neutral-75 text-body font-bold')}>
        <span>{totalLabel}</span>
        <span className="text-right tabular-nums">{totalHours}</span>
        <span className="text-right tabular-nums">{totalDays}</span>
        <span />
      </div>
    </Card>
  );
}
