import React, { useMemo, useState } from 'react';
import type { WorklogEntry } from '../../model/types';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import { calendarCells, deriveWorkedByClient, WEEKDAYS, ymOf, type CalendarMode } from '../utils';
import { CalendarGrid, colorFor, labelFor, Legend, PeriodNav, WorkedPerClient, type LegendEntry } from './calendar-view';

/** Month- or week-grid overview of who you worked for each day, with the period's
 * work rolled up per client underneath. Clicking a day opens it in the Day view,
 * where past days can be edited and future days can be planned. */
export function CalendarView() {
  const { worklog, tasks, colorOf, clientName, today, weekStart, openDetail } = useData();
  const { selectedDate, setSelectedDate } = useUi();
  const [mode, setMode] = useState<CalendarMode>('month');
  // A full date, not a YYYY-MM: switching between month and week then keeps the
  // calendar parked on the same day instead of jumping to the 1st.
  const [cursor, setCursor] = useState(() => selectedDate || today);

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

  const cells = useMemo(() => calendarCells(mode, cursor, weekStart), [mode, cursor, weekStart]);

  // Colors used across the visible period, deduped by client/event id, so the
  // mobile color-only cells can be decoded via a legend underneath the grid.
  const legend = useMemo<LegendEntry[]>(() => {
    const seen = new Map<string, { color: string; label: string }>();
    for (const date of cells) {
      if (!date) continue;
      for (const l of logsByDate.get(date) ?? []) {
        if (seen.has(l.clientId)) continue;
        seen.set(l.clientId, { color: colorFor(l.clientId, colorOf), label: labelFor(l.clientId, clientName) });
      }
    }
    return [...seen.entries()].map(([id, e]) => ({ id, ...e }));
  }, [cells, logsByDate, colorOf, clientName]);

  // What was worked in the visible period, per client.
  const groups = useMemo(
    () => deriveWorkedByClient(cells, tasks, worklog, { clientName, colorOf }),
    [cells, tasks, worklog, clientName, colorOf],
  );

  const openDay = (date: string) => {
    setSelectedDate(date);
    navigateToView('day');
  };
  const openTask = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (t) {
      openDetail(t);
    }
  };
  const isWeek = mode === 'week';
  // A week grid holds exactly its own seven days, so today being among the cells
  // means it's the current week; a month grid pads with neighbouring days, so
  // that check would light up on the months either side — compare the month.
  const isCurrentPeriod = isWeek ? cells.includes(today) : ymOf(cursor) === ymOf(today);

  return (
    <div className="flex-1 overflow-auto px-6 pt-8 pb-20">
      <div className="max-w-[920px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-7">
          <h1 className="text-[24px] font-bold m-0 tracking-[-0.01em]">Calendar</h1>
          <div className="hidden md:block flex-1" />
          <PeriodNav mode={mode} onModeChange={setMode} cursor={cursor} onCursorChange={setCursor} isCurrentPeriod={isCurrentPeriod} />
        </div>

        <CalendarGrid weekdays={weekdays} cells={cells} logsByDate={logsByDate} cursor={cursor} isWeek={isWeek} onOpenDay={openDay} />

        <Legend entries={legend} />

        <WorkedPerClient groups={groups} isWeek={isWeek} onOpenDay={openDay} onOpenTask={openTask} />
      </div>
    </div>
  );
}
