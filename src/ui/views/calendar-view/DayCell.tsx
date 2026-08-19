import React from 'react';
import { NotebookPenIcon } from 'lucide-react';
import type { WorklogEntry } from '../../../model/types';
import { useData } from '../../context';
import { NOTE_COLOR, roundHours } from '../../utils';
import { colorFor, labelFor } from './entryLabels';

export interface DayCellProps {
  date: string;
  logs: WorklogEntry[];
  /** The day carries a freeform note. Marked, not shown: the grid is about time. */
  hasNote: boolean;
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
export function DayCell({ date, logs, hasNote, isToday, isSelected, isOtherMonth, isWeek, maxPerCell, onOpen }: DayCellProps) {
  const { clientName, colorOf } = useData();
  const day = Number(date.slice(8, 10));
  const lines = logs.map((l) => `${labelFor(l.clientId, clientName)} · ${l.hours}h`);
  if (hasNote) {
    lines.push('Has notes');
  }
  // The day's total, in the cell itself: `title` is hover-only, which on touch
  // means never, and "did I log a full day?" is the question the grid is for.
  const totalHours = roundHours(logs.reduce((sum, l) => sum + l.hours, 0));
  return (
    <button
      onClick={onOpen}
      title={lines.length ? lines.join('\n') : undefined}
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
      <span className="flex items-center justify-between w-full">
        <span
          className={
            'text-control leading-none w-[22px] h-[22px] flex items-center justify-center rounded-full ' +
            (isToday ? 'bg-neutral-825 text-white font-semibold' : 'text-neutral-750 font-medium')
          }
        >
          {day}
        </span>
        <span className="flex items-center gap-[4px]">
          {totalHours > 0 && (
            <span className="text-eyebrow font-medium text-neutral-675 tabular-nums leading-none">{totalHours}h</span>
          )}
          {hasNote && <NotebookPenIcon size={12} className="shrink-0 mr-[2px]" style={{ color: NOTE_COLOR }} aria-hidden="true" />}
        </span>
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
              <span className="text-eyebrow text-neutral-650 tabular-nums shrink-0">{roundHours(l.hours)}h</span>
            </span>
          ))}
          {logs.length > maxPerCell && <span className="text-status text-neutral-650 pl-[12px]">+{logs.length - maxPerCell} more</span>}
        </span>
      )}
    </button>
  );
}
