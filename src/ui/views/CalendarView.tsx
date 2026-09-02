import React, { useMemo, useState } from 'react';
import { CalendarRangeIcon } from 'lucide-react';
import type { WorklogEntry } from '../../model/types';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import { daysSinceEpoch } from '../../util/date';
import { calendarCells, datesInRange, deriveWorkedByClient, WEEKDAYS, ymOf, type CalendarMode } from '../utils';
import { Button, ViewHeader } from '../primitives';
import { CalendarGrid, colorFor, labelFor, Legend, PeriodNav, RangeLogBar, WorkedPerClient, type LegendEntry } from './calendar-view';

/** The two ends of a range, in date order — either one can be picked or typed
 * first. */
function ordered(a: string, b: string): { from: string; to: string } {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** Month- or week-grid overview of who you worked for each day, with the period's
 * work rolled up per client underneath. Clicking a day opens it in the Day view,
 * where past days can be edited and future days can be planned. Picking two days
 * instead selects the run between them, so a fortnight of vacation is one write. */
export function CalendarView() {
  const { worklog, tasks, colorOf, clientName, today, weekStart, openDetail, datesWithNotes, logRange } = useData();
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

  // The range being picked for a bulk log, held as its two ends rather than an
  // anchor: a `to` that is still empty is the state the bar has to name ("now
  // click the last day"), and it is what the bar's own From/To fields edit.
  const [selectMode, setSelectMode] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });
  // The day under the pointer while the second end is open, so the run lights up
  // before it is committed to — a range you can see is a range you don't have to
  // be told about.
  const [hover, setHover] = useState('');

  const rangeDates = useMemo(
    () => (range.from ? datesInRange(range.from, range.to || range.from) : []),
    [range],
  );
  const highlighted = useMemo(
    () => new Set(range.from && !range.to && hover ? datesInRange(range.from, hover) : rangeDates),
    [range, hover, rangeDates],
  );

  const clearSelection = () => {
    setSelectMode(false);
    setRange({ from: '', to: '' });
    setHover('');
  };

  const openDay = (date: string) => {
    setSelectedDate(date);
    navigateToView('day');
  };

  /** A cell click: opening the day is still the default, so selecting is either
   *  armed by the toolbar (which is also the touch path — there is no shift key
   *  on a phone) or asked for one click at a time with Shift. */
  const clickDay = (date: string, extend: boolean) => {
    if (!selectMode && !extend) {
      openDay(date);
      return;
    }
    setSelectMode(true);
    setHover('');
    setRange((cur) => {
      if (extend) {
        return ordered(cur.from || (cells.includes(selectedDate) ? selectedDate : date), date);
      }
      if (!cur.from) {
        return { from: date, to: '' };
      }
      if (!cur.to) {
        return ordered(cur.from, date);
      }
      // Both ends are down, so this click moves the nearer one. Overshooting by a
      // day is then one click to correct — starting the range over was the
      // surprise, because nothing on screen said a third click meant that.
      const toFrom = Math.abs(daysSinceEpoch(date) - daysSinceEpoch(cur.from));
      const toTo = Math.abs(daysSinceEpoch(date) - daysSinceEpoch(cur.to));
      return toFrom <= toTo ? ordered(date, cur.to) : ordered(cur.from, date);
    });
  };

  /** Hover only counts while the last day is outstanding: the calendar re-renders
   *  on it, and pointing at days is not something the rest of the view cares
   *  about. */
  const hoverDay = (date: string) => {
    if (selectMode && range.from && !range.to) {
      setHover(date);
    }
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
    <div className="flex flex-1 flex-col min-h-0">
      {/* Stepping through periods stays in reach while the per-client roll-up
          below the grid is being read. */}
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex flex-col md:flex-row md:items-center gap-3">
        <h1 className="text-[24px] font-bold m-0 tracking-[-0.01em]">Calendar</h1>
        <div className="hidden md:block flex-1" />
        <Button
          size="xs"
          variant={selectMode ? 'primary' : 'secondary'}
          aria-pressed={selectMode}
          onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
          title="Log the same thing on a run of days — a fortnight of vacation, a week on one client"
          className="shrink-0"
        >
          <CalendarRangeIcon size={14} className={selectMode ? undefined : 'text-neutral-675'} /> Log a range
        </Button>
        <PeriodNav mode={mode} onModeChange={setMode} cursor={cursor} onCursorChange={setCursor} isCurrentPeriod={isCurrentPeriod} />
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-20">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {selectMode && (
            <RangeLogBar
              from={range.from}
              to={range.to}
              onChange={(next) => setRange(next.from && next.to ? ordered(next.from, next.to) : next)}
              onClear={clearSelection}
              onLog={({ dates, clientId, hours, note }) => {
                clearSelection();
                void logRange(dates, clientId, hours, note);
              }}
            />
          )}

          <CalendarGrid
            weekdays={weekdays}
            cells={cells}
            logsByDate={logsByDate}
            datesWithNotes={datesWithNotes}
            cursor={cursor}
            isWeek={isWeek}
            rangeDates={highlighted}
            onOpenDay={clickDay}
            onHoverDay={hoverDay}
          />

          <Legend entries={legend} />

          <WorkedPerClient groups={groups} isWeek={isWeek} onOpenDay={openDay} onOpenTask={openTask} />
        </div>
      </div>
    </div>
  );
}
