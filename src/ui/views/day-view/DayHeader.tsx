import React from 'react';
import { CalendarArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Badge, Button, IconButton, ViewHeader } from '../../primitives';
import { fmtLong, shiftDate } from '../../utils';

type DayHeaderProps = {
  selectedDate: string;
  today: string;
  isTodaySel: boolean;
  editDayOpen: boolean;
  setEditDayOpen: (open: boolean) => void;
  onSelectDate: (date: string) => void;
  isFuture: boolean;
  openTaskFormForDue: (date: string) => void;
};

export function DayHeader({
  selectedDate,
  today,
  isTodaySel,
  editDayOpen,
  setEditDayOpen,
  onSelectDate,
  isFuture,
  openTaskFormForDue,
}: DayHeaderProps) {
  return (
    // In the band above the day's scroll area rather than at the top of it:
    // stepping to another day is the thing you reach for after reading to the
    // bottom of this one.
    <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Day navigation, then the date. The controls sit left of the label at a
       * fixed width, so stepping through days never shifts them under the cursor
       * the way a date sandwiched between the arrows does. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        <Button size="md" onClick={() => onSelectDate(today)} disabled={isTodaySel} title="Jump to today" className="shrink-0">
          <CalendarArrowUpIcon size={15} className="text-neutral-675" /> Today
        </Button>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton onClick={() => onSelectDate(shiftDate(selectedDate, -1))} title="Previous day" aria-label="Previous day">
            <ChevronLeftIcon size={18} />
          </IconButton>
          <IconButton onClick={() => onSelectDate(shiftDate(selectedDate, 1))} title="Next day" aria-label="Next day">
            <ChevronRightIcon size={18} />
          </IconButton>
        </div>
        <h1 className="text-[20px] sm:text-[24px] font-bold m-0 tracking-[-0.01em] whitespace-nowrap">{fmtLong(selectedDate)}</h1>
        {/* The date alone reads the same on any day; the pill is what says you're
         * looking at the current one, now that the heading no longer says "Today". */}
        {isTodaySel && (
          <Badge tone="brand" size="sm" className="uppercase tracking-eyebrow">
            Today
          </Badge>
        )}
      </div>

      {/* Day actions. Stack full-width below the date on mobile, then push to the
       * right edge alongside the date from `sm:` up. */}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {!isTodaySel && (
          <button
            onClick={() => setEditDayOpen(!editDayOpen)}
            className={
              'text-meta border rounded-control cursor-pointer px-2 py-[5px] ' +
              (editDayOpen
                ? 'text-brand-650 border-brand-500 bg-brand-225'
                : 'text-info border-neutral-525 bg-white')
            }
          >
            {editDayOpen ? 'Hide day editor' : 'Edit day'}
          </button>
        )}
        {isFuture && (
          <Button
            variant="primary"
            size="md"
            onClick={() => openTaskFormForDue(selectedDate)}
            title="Add a task due on this day"
            className="flex-1 sm:flex-none"
          >
            <span className="text-[15px] leading-none">+</span> Add task for this day
          </Button>
        )}
      </div>
    </ViewHeader>
  );
}
