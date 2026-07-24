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
    <div className="flex items-center gap-3 mb-7">
      <button onClick={() => onSelectDate(shiftDate(selectedDate, -1))} title="Previous day" className="w-7 h-7 border border-[#E5E7EB] rounded-md bg-white text-[#57606A] cursor-pointer flex items-center justify-center hover:bg-[#F6F7F9]">
        {'<'}
      </button>
      <h1 className="text-[24px] font-bold m-0 tracking-[-0.01em]">{isTodaySel ? 'Today' : fmtLong(selectedDate)}</h1>
      <span className="text-[14px] text-[#6E7781]">{isTodaySel ? fmtLong(selectedDate) : ''}</span>
      <button onClick={() => onSelectDate(shiftDate(selectedDate, 1))} title="Next day" className="w-7 h-7 border border-[#E5E7EB] rounded-md bg-white text-[#57606A] cursor-pointer flex items-center justify-center hover:bg-[#F6F7F9]">
        {'>'}
      </button>
      {!isTodaySel && (
        <>
          <button
            onClick={() => setEditDayOpen(!editDayOpen)}
            className={
              'text-[12px] border rounded-md cursor-pointer px-[8px] py-[5px] ' +
              (editDayOpen
                ? 'text-[#7A5600] border-[#E2BE2E] bg-[#FBEFC0]'
                : 'text-[#2D6CDF] border-[#D0D7DE] bg-white')
            }
          >
            {editDayOpen ? 'Hide day editor' : 'Edit day'}
          </button>
          <button onClick={() => onSelectDate(today)} className="text-[12px] text-[#2D6CDF] bg-none border-none cursor-pointer px-[6px] py-1">
            Jump to today
          </button>
        </>
      )}
      <div className="flex-1" />
      {isFuture && (
        <button
          onClick={() => openModalForDue(selectedDate)}
          title="Add a task due on this day"
          className="flex items-center gap-[6px] px-[14px] py-[8px] border border-[#E2BE2E] rounded-[8px] bg-[#F4CF4D] text-[#3A2E05] font-semibold text-[13px] cursor-pointer hover:bg-[#F2C835]"
        >
          <span className="text-[15px] leading-none">+</span> Add task for this day
        </button>
      )}
    </div>
  );
}
