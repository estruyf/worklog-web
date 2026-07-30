import React from 'react';
import { CalendarArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button, IconButton, SegmentedControl } from '../../primitives';
import { useData } from '../../context';
import { periodLabel, shiftPeriod, type CalendarMode } from '../../utils';

export interface PeriodNavProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  cursor: string;
  onCursorChange: (cursor: string) => void;
  /** Today is already in view, so "Today" has nowhere to go. */
  isCurrentPeriod: boolean;
}

/** Month/week switch and the period stepper. Same control order as the Day view:
 *  Today, then the arrows, then the period label — so stepping through periods
 *  leaves the buttons put. */
export function PeriodNav({ mode, onModeChange, cursor, onCursorChange, isCurrentPeriod }: PeriodNavProps) {
  const { today, weekStart } = useData();
  const isWeek = mode === 'week';
  return (
    <>
      <SegmentedControl
        aria-label="Calendar period"
        size="sm"
        options={[
          { value: 'month', label: 'Month' },
          { value: 'week', label: 'Week' },
        ]}
        value={mode}
        onChange={onModeChange}
        className="self-start md:self-auto"
      />
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          onClick={() => onCursorChange(today)}
          disabled={isCurrentPeriod}
          title={isWeek ? 'Jump to this week' : 'Jump to this month'}
          className="shrink-0"
        >
          <CalendarArrowUpIcon size={14} className="text-neutral-675" /> Today
        </Button>
        <IconButton
          size="sm"
          onClick={() => onCursorChange(shiftPeriod(mode, cursor, -1, weekStart))}
          title={isWeek ? 'Previous week' : 'Previous month'}
          aria-label={isWeek ? 'Previous week' : 'Previous month'}
        >
          <ChevronLeftIcon size={16} />
        </IconButton>
        <IconButton
          size="sm"
          onClick={() => onCursorChange(shiftPeriod(mode, cursor, 1, weekStart))}
          title={isWeek ? 'Next week' : 'Next month'}
          aria-label={isWeek ? 'Next week' : 'Next month'}
        >
          <ChevronRightIcon size={16} />
        </IconButton>
        <div className="flex-1 md:flex-none text-[15px] font-semibold whitespace-nowrap">{periodLabel(mode, cursor, weekStart)}</div>
      </div>
    </>
  );
}
