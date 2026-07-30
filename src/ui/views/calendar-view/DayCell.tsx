import React from 'react';
import type { WorklogEntry } from '../../../model/types';
import { useData } from '../../context';
import { colorFor, labelFor } from './entryLabels';

export interface DayCellProps {
  date: string;
  logs: WorklogEntry[];
  isToday: boolean;
  isSelected: boolean;
  /** A month grid pads with the neighbouring months' days; those read back. */
  isOtherMonth: boolean;
  /** Week cells are taller and list more before collapsing into "+n more". */
  isWeek: boolean;
  maxPerCell: number;
  onOpen: () => void;
}

/** One day in the grid: its number, and who was worked for. On a phone the names
 *  don't fit, so the cell shows colour dots and the legend under the grid decodes
 *  them; from `md` up it lists the names themselves. */
export function DayCell({ date, logs, isToday, isSelected, isOtherMonth, isWeek, maxPerCell, onOpen }: DayCellProps) {
  const { clientName, colorOf } = useData();
  const day = Number(date.slice(8, 10));
  return (
    <button
      onClick={onOpen}
      title={logs.length ? logs.map((l) => `${labelFor(l.clientId, clientName)} · ${l.hours}h`).join('\n') : undefined}
      className={
        'rounded-[10px] border p-[7px] text-left cursor-pointer flex flex-col gap-[6px] transition-colors ' +
        (isWeek ? 'min-h-[150px] ' : 'min-h-[84px] ') +
        (isSelected
          ? 'border-brand-500 bg-brand-225'
          : isOtherMonth
            ? 'border-neutral-375 bg-neutral-100 hover:bg-neutral-200 hover:border-neutral-475'
            : 'border-neutral-375 bg-white hover:bg-neutral-200 hover:border-neutral-475')
      }
    >
      <span
        className={
          'text-control leading-none w-[22px] h-[22px] flex items-center justify-center rounded-full self-start ' +
          (isToday ? 'bg-neutral-825 text-white font-semibold' : 'text-neutral-750 font-medium')
        }
      >
        {day}
      </span>
      {logs.length > 0 && (
        <span className="flex md:hidden flex-wrap gap-[3px] w-full">
          {Array.from(new Set(logs.map((l) => colorFor(l.clientId, colorOf)))).map((c, j) => (
            <span key={j} className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: c }} />
          ))}
        </span>
      )}
      {logs.length > 0 && (
        <span className="hidden md:flex flex-col gap-[3px] w-full overflow-hidden">
          {logs.slice(0, maxPerCell).map((l, j) => (
            <span key={j} className="flex items-center gap-[5px] min-w-0">
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: colorFor(l.clientId, colorOf) }} />
              <span className="text-eyebrow text-neutral-750 truncate">{labelFor(l.clientId, clientName)}</span>
            </span>
          ))}
          {logs.length > maxPerCell && <span className="text-status text-neutral-650 pl-[12px]">+{logs.length - maxPerCell} more</span>}
        </span>
      )}
    </button>
  );
}
