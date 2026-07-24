import React, { useMemo, useState } from 'react';
import { WorklogEntry } from '../../model/types';
import { eventTypeFromClientId, formatEventTypeLabel, isEventWorklogClientId } from '../../model/worklog';
import { useData, useUi } from '../context';
import { monthLabel, WEEKDAYS } from '../utils';

const EVENT_COLOR = '#8B5CF6';

/** The year-month (YYYY-MM) a date string falls in. */
function ymOf(date: string): string {
  return date.slice(0, 7);
}

/** Step a YYYY-MM cursor by whole months, staying local-date safe. */
function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/** All day cells for a month (YYYY-MM), starting on `weekStart` (0 = Sunday …
 * 6 = Saturday) and padded with leading/trailing nulls so the grid always fills
 * whole weeks. */
function monthCells(ym: string, weekStart: number): (string | null)[] {
  const [y, m] = ym.split('-').map(Number);
  // Days from the configured week start to the 1st, wrapped into 0–6.
  const lead = (new Date(y, m - 1, 1).getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

/** Month-grid overview of who you worked for each day. Clicking a day opens it in
 * the Day view, where past days can be edited and future days can be planned. */
export function CalendarView() {
  const { worklog, colorOf, clientName, today, weekStart } = useData();
  const { selectedDate, setSelectedDate, setView } = useUi();
  const [cursor, setCursor] = useState(() => ymOf(selectedDate || today));

  // Weekday headers rotated to start on the configured first day of the week.
  const weekdays = useMemo(() => WEEKDAYS.map((_, i) => WEEKDAYS[(i + weekStart) % 7]), [weekStart]);

  // Worklog entries bucketed by day, so each cell is an O(1) lookup.
  const logsByDate = useMemo(() => {
    const m = new Map<string, WorklogEntry[]>();
    for (const w of worklog) {
      const list = m.get(w.date);
      if (list) {
        list.push(w);
      } else {
        m.set(w.date, [w]);
      }
    }
    return m;
  }, [worklog]);

  const cells = useMemo(() => monthCells(cursor, weekStart), [cursor, weekStart]);

  const openDay = (date: string) => {
    setSelectedDate(date);
    setView('day');
  };

  return (
    <div className="flex-1 overflow-auto px-6 pt-8 pb-20">
      <div className="max-w-[920px] mx-auto">
        <div className="flex items-center gap-3 mb-7">
          <h1 className="text-[24px] font-bold m-0 tracking-[-0.01em]">Calendar</h1>
          <div className="flex-1" />
          <button onClick={() => setCursor(shiftMonth(cursor, -1))} title="Previous month" className="w-7 h-7 border border-[#E5E7EB] rounded-md bg-white text-[#57606A] cursor-pointer flex items-center justify-center hover:bg-[#F6F7F9]">
            {'<'}
          </button>
          <div className="text-[15px] font-semibold min-w-[110px] text-center">{monthLabel(cursor)}</div>
          <button onClick={() => setCursor(shiftMonth(cursor, 1))} title="Next month" className="w-7 h-7 border border-[#E5E7EB] rounded-md bg-white text-[#57606A] cursor-pointer flex items-center justify-center hover:bg-[#F6F7F9]">
            {'>'}
          </button>
          <button onClick={() => { openDay(today); setCursor(ymOf(today)); }} className="text-[12px] text-[#2D6CDF] border border-[#D0D7DE] rounded-md bg-white cursor-pointer px-[10px] py-[5px] hover:bg-[#F6F7F9]">
            Today
          </button>
        </div>

        <div className="grid grid-cols-7 gap-[6px] mb-2">
          {weekdays.map((w) => (
            <div key={w} className="text-[11px] font-bold tracking-[0.06em] text-[#6E7781] text-center py-1">
              {w.toUpperCase()}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[6px]">
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`pad-${i}`} className="min-h-[84px] rounded-[10px] bg-[#FAFBFC]" />;
            }
            const day = Number(date.slice(8, 10));
            const logs = logsByDate.get(date) ?? [];
            const isToday = date === today;
            const isSel = date === selectedDate;
            return (
              <button
                key={date}
                onClick={() => openDay(date)}
                title={logs.length ? logs.map((l) => `${labelFor(l.clientId, clientName)} · ${l.hours}h`).join('\n') : undefined}
                className={
                  'min-h-[84px] rounded-[10px] border p-[7px] text-left cursor-pointer flex flex-col gap-[6px] transition-colors ' +
                  (isSel
                    ? 'border-[#E2BE2E] bg-[#FBEFC0]'
                    : 'border-[#ECEEF1] bg-white hover:bg-[#F6F7F9] hover:border-[#DDE1E6]')
                }
              >
                <span
                  className={
                    'text-[13px] leading-none w-[22px] h-[22px] flex items-center justify-center rounded-full self-start ' +
                    (isToday ? 'bg-[#1F2328] text-white font-semibold' : 'text-[#3C4149] font-medium')
                  }
                >
                  {day}
                </span>
                {logs.length > 0 && (
                  <span className="flex flex-col gap-[3px] w-full overflow-hidden">
                    {logs.slice(0, 3).map((l, j) => (
                      <span key={j} className="flex items-center gap-[5px] min-w-0">
                        <span
                          className="w-[7px] h-[7px] rounded-full shrink-0"
                          style={{ background: isEventWorklogClientId(l.clientId) ? EVENT_COLOR : colorOf(l.clientId) }}
                        />
                        <span className="text-[11px] text-[#3C4149] truncate">{labelFor(l.clientId, clientName)}</span>
                      </span>
                    ))}
                    {logs.length > 3 && <span className="text-[10.5px] text-[#8A9099] pl-[12px]">+{logs.length - 3} more</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Display name for a worklog client id, resolving event pseudo-clients. */
function labelFor(clientId: string, clientName: (id: string) => string): string {
  return isEventWorklogClientId(clientId) ? formatEventTypeLabel(eventTypeFromClientId(clientId)) : clientName(clientId);
}
