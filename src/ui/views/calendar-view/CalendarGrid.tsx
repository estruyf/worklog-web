import React from 'react';
import type { WorklogEntry } from '../../../model/types';
import { SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';
import { ymOf } from '../../utils';
import { DayCell } from './DayCell';

export interface CalendarGridProps {
  /** Weekday headers, already rotated to the configured first day of the week. */
  weekdays: string[];
  /** The period's days; `null` is a month grid's padding. */
  cells: (string | null)[];
  logsByDate: Map<string, WorklogEntry[]>;
  /** Dates carrying a freeform day note. */
  datesWithNotes: Set<string>;
  cursor: string;
  isWeek: boolean;
  /** The days currently picked for a bulk log — including the run under the
   *  pointer, while the range's last day is still open. */
  rangeDates: Set<string>;
  onOpenDay: (date: string, extend: boolean) => void;
  onHoverDay: (date: string) => void;
}

export function CalendarGrid({
  weekdays,
  cells,
  logsByDate,
  datesWithNotes,
  cursor,
  isWeek,
  rangeDates,
  onOpenDay,
  onHoverDay,
}: CalendarGridProps) {
  const { today } = useData();
  const { selectedDate } = useUi();
  // A week shows a seventh of the days a month does, so its cells get the room to
  // list every client that logged time rather than collapsing into "+n more".
  const maxPerCell = isWeek ? 6 : 3;
  return (
    <>
      <div className="grid grid-cols-7 gap-[6px] mb-2">
        {weekdays.map((w) => (
          <SectionLabel key={w} className="justify-center py-1">
            {w}
          </SectionLabel>
        ))}
      </div>

      {/* Leaving the grid drops the previewed run; leaving one cell would drop it
          in the gap between two. */}
      <div className="grid grid-cols-7 gap-[6px]" onMouseLeave={() => onHoverDay('')}>
        {cells.map((date, i) =>
          date ? (
            <DayCell
              key={date}
              date={date}
              logs={logsByDate.get(date) ?? []}
              hasNote={datesWithNotes.has(date)}
              isToday={date === today}
              isSelected={date === selectedDate}
              isOtherMonth={!isWeek && ymOf(date) !== ymOf(cursor)}
              isWeek={isWeek}
              isInRange={rangeDates.has(date)}
              maxPerCell={maxPerCell}
              onOpen={(extend) => onOpenDay(date, extend)}
              onHover={() => onHoverDay(date)}
            />
          ) : (
            <div key={`pad-${i}`} className="min-h-[84px] rounded-[10px] bg-neutral-100" />
          ),
        )}
      </div>
    </>
  );
}
