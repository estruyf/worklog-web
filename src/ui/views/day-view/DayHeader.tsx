import React from 'react';
import { CalendarArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
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
    <div className="flex flex-col gap-3 mb-7 sm:flex-row sm:items-center">
      {/* Day navigation, then the date. The controls sit left of the label at a
       * fixed width, so stepping through days never shifts them under the cursor
       * the way a date sandwiched between the arrows does. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        <button
          onClick={() => onSelectDate(today)}
          disabled={isTodaySel}
          title="Jump to today"
          className="shrink-0 flex items-center gap-1.5 h-8 px-3 border border-neutral-400 rounded-lg bg-white text-[13px] font-semibold text-neutral-825 cursor-pointer hover:bg-neutral-200 disabled:text-neutral-625 disabled:cursor-default disabled:hover:bg-white"
        >
          <CalendarArrowUpIcon size={15} className="text-neutral-675" /> Today
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onSelectDate(shiftDate(selectedDate, -1))} title="Previous day" className="w-8 h-8 rounded-lg bg-transparent border-none text-neutral-700 cursor-pointer flex items-center justify-center hover:bg-neutral-225">
            <ChevronLeftIcon size={18} />
          </button>
          <button onClick={() => onSelectDate(shiftDate(selectedDate, 1))} title="Next day" className="w-8 h-8 rounded-lg bg-transparent border-none text-neutral-700 cursor-pointer flex items-center justify-center hover:bg-neutral-225">
            <ChevronRightIcon size={18} />
          </button>
        </div>
        <h1 className="text-[20px] sm:text-[24px] font-bold m-0 tracking-[-0.01em] whitespace-nowrap">{fmtLong(selectedDate)}</h1>
        {/* The date alone reads the same on any day; the pill is what says you're
         * looking at the current one, now that the heading no longer says "Today". */}
        {isTodaySel && (
          <span className="inline-flex items-center px-[9px] py-[2px] rounded-full bg-brand-225 border border-brand-350 text-brand-650 text-[11px] font-semibold uppercase tracking-[0.04em]">
            Today
          </span>
        )}
      </div>

      {/* Day actions. Stack full-width below the date on mobile, then push to the
       * right edge alongside the date from `sm:` up. */}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {!isTodaySel && (
          <button
            onClick={() => setEditDayOpen(!editDayOpen)}
            className={
              'text-[12px] border rounded-md cursor-pointer px-2 py-[5px] ' +
              (editDayOpen
                ? 'text-brand-650 border-brand-500 bg-brand-225'
                : 'text-info border-neutral-525 bg-white')
            }
          >
            {editDayOpen ? 'Hide day editor' : 'Edit day'}
          </button>
        )}
        {isFuture && (
          <button
            onClick={() => openTaskFormForDue(selectedDate)}
            title="Add a task due on this day"
            className="flex-1 sm:flex-none flex items-center justify-center gap-[6px] px-[14px] py-[8px] border border-brand-500 rounded-[8px] bg-brand-450 text-brand-800 font-semibold text-[13px] cursor-pointer hover:bg-brand-475 whitespace-nowrap"
          >
            <span className="text-[15px] leading-none">+</span> Add task for this day
          </button>
        )}
      </div>
    </div>
  );
}
