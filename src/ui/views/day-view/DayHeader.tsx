import React from 'react';
import { fmtLong, shiftDate } from '../../utils';

type DayHeaderProps = {
  selectedDate: string;
  today: string;
  isTodaySel: boolean;
  editDayOpen: boolean;
  setEditDayOpen: (open: boolean) => void;
  onSelectDate: (date: string) => void;
  isFuture: boolean;
  openModalForDue: (date: string) => void;
};

export function DayHeader({
  selectedDate,
  today,
  isTodaySel,
  editDayOpen,
  setEditDayOpen,
  onSelectDate,
  isFuture,
  openModalForDue,
}: DayHeaderProps) {
  return (
    <div className="flex flex-col gap-3 mb-7 sm:flex-row sm:items-center">
      {/* Date + day navigation. Spans the full width on mobile with the arrows
       * pushed to either edge; collapses to a tight group from `sm:` up. */}
      <div className="flex items-center gap-2 min-w-0 justify-between sm:justify-start">
        <button onClick={() => onSelectDate(shiftDate(selectedDate, -1))} title="Previous day" className="w-8 h-8 sm:w-7 sm:h-7 shrink-0 border border-neutral-400 rounded-md bg-white text-neutral-700 cursor-pointer flex items-center justify-center hover:bg-neutral-200">
          {'<'}
        </button>
        <div className="min-w-0 text-center sm:text-left">
          <h1 className="text-[20px] sm:text-[24px] font-bold m-0 tracking-[-0.01em] whitespace-nowrap">{isTodaySel ? 'Today' : fmtLong(selectedDate)}</h1>
          {isTodaySel && <span className="text-[13px] text-neutral-675 whitespace-nowrap">{fmtLong(selectedDate)}</span>}
        </div>
        <button onClick={() => onSelectDate(shiftDate(selectedDate, 1))} title="Next day" className="w-8 h-8 sm:w-7 sm:h-7 shrink-0 border border-neutral-400 rounded-md bg-white text-neutral-700 cursor-pointer flex items-center justify-center hover:bg-neutral-200">
          {'>'}
        </button>
      </div>

      {/* Day actions. Stack full-width below the date on mobile, then push to the
       * right edge alongside the date from `sm:` up. */}
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {!isTodaySel && (
          <>
            <button
              onClick={() => setEditDayOpen(!editDayOpen)}
              className={
                'text-[12px] border rounded-md cursor-pointer px-[8px] py-[5px] ' +
                (editDayOpen
                  ? 'text-brand-650 border-brand-500 bg-brand-225'
                  : 'text-info border-neutral-525 bg-white')
              }
            >
              {editDayOpen ? 'Hide day editor' : 'Edit day'}
            </button>
            <button onClick={() => onSelectDate(today)} className="text-[12px] text-info bg-none border-none cursor-pointer px-[6px] py-1">
              Jump to today
            </button>
          </>
        )}
        {isFuture && (
          <button
            onClick={() => openModalForDue(selectedDate)}
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
