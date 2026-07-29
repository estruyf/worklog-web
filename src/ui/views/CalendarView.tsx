import React, { useMemo, useState } from 'react';
import type { WorklogEntry } from '../../model/types';
import { eventTypeFromClientId, formatEventTypeLabel, isEventWorklogClientId } from '../../model/worklog';
import { CalendarArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import {
  calendarCells,
  deriveWorkedByClient,
  EVENT_COLOR,
  fmtShort,
  num,
  periodLabel,
  shiftPeriod,
  WEEKDAYS,
  ymOf,
  type CalendarMode,
  type ClientWorkGroup,
} from '../utils';

/** Month- or week-grid overview of who you worked for each day, with the period's
 * work rolled up per client underneath. Clicking a day opens it in the Day view,
 * where past days can be edited and future days can be planned. */
export function CalendarView() {
  const { worklog, tasks, colorOf, clientName, hoursPerDay, today, weekStart, openDetail } = useData();
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
  const legend = useMemo(() => {
    const seen = new Map<string, { color: string; label: string }>();
    for (const date of cells) {
      if (!date) continue;
      for (const l of logsByDate.get(date) ?? []) {
        if (seen.has(l.clientId)) continue;
        seen.set(l.clientId, {
          color: isEventWorklogClientId(l.clientId) ? EVENT_COLOR : colorOf(l.clientId),
          label: labelFor(l.clientId, clientName),
        });
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
  // A week shows a seventh of the days a month does, so its cells get the room to
  // list every client that logged time rather than collapsing into "+n more".
  const isWeek = mode === 'week';
  const maxPerCell = isWeek ? 6 : 3;
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
          <div className="flex items-center gap-1 p-[3px] rounded-lg bg-neutral-225 border border-neutral-400 self-start md:self-auto">
            {(['month', 'week'] as CalendarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={
                  'text-[12px] font-semibold capitalize rounded-md px-[10px] py-[4px] cursor-pointer border ' +
                  (mode === m ? 'bg-white border-neutral-475 text-neutral-825' : 'bg-transparent border-transparent text-neutral-675 hover:text-neutral-825')
                }
              >
                {m}
              </button>
            ))}
          </div>
          {/* Same control order as the Day view: Today, then the arrows, then the
           * period label — so stepping through periods leaves the buttons put. */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(today)}
              disabled={isCurrentPeriod}
              title={isWeek ? 'Jump to this week' : 'Jump to this month'}
              className="shrink-0 flex items-center gap-1.5 h-7 px-2.5 border border-neutral-400 rounded-lg bg-white text-[12px] font-semibold text-neutral-825 cursor-pointer hover:bg-neutral-200 disabled:text-neutral-625 disabled:cursor-default disabled:hover:bg-white"
            >
              <CalendarArrowUpIcon size={14} className="text-neutral-675" /> Today
            </button>
            <button onClick={() => setCursor(shiftPeriod(mode, cursor, -1, weekStart))} title={isWeek ? 'Previous week' : 'Previous month'} className="w-7 h-7 rounded-lg bg-transparent border-none text-neutral-700 cursor-pointer flex items-center justify-center hover:bg-neutral-225">
              <ChevronLeftIcon size={16} />
            </button>
            <button onClick={() => setCursor(shiftPeriod(mode, cursor, 1, weekStart))} title={isWeek ? 'Next week' : 'Next month'} className="w-7 h-7 rounded-lg bg-transparent border-none text-neutral-700 cursor-pointer flex items-center justify-center hover:bg-neutral-225">
              <ChevronRightIcon size={16} />
            </button>
            <div className="flex-1 md:flex-none text-[15px] font-semibold whitespace-nowrap">{periodLabel(mode, cursor, weekStart)}</div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-[6px] mb-2">
          {weekdays.map((w) => (
            <div key={w} className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 text-center py-1">
              {w.toUpperCase()}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[6px]">
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`pad-${i}`} className="min-h-[84px] rounded-[10px] bg-neutral-100" />;
            }
            const day = Number(date.slice(8, 10));
            const logs = logsByDate.get(date) ?? [];
            const isToday = date === today;
            const isSel = date === selectedDate;
            const isOtherMonth = !isWeek && ymOf(date) !== ymOf(cursor);
            return (
              <button
                key={date}
                onClick={() => openDay(date)}
                title={logs.length ? logs.map((l) => `${labelFor(l.clientId, clientName)} · ${l.hours}h`).join('\n') : undefined}
                className={
                  'rounded-[10px] border p-[7px] text-left cursor-pointer flex flex-col gap-[6px] transition-colors ' +
                  (isWeek ? 'min-h-[150px] ' : 'min-h-[84px] ') +
                  (isSel
                    ? 'border-brand-500 bg-brand-225'
                    : isOtherMonth
                      ? 'border-neutral-375 bg-neutral-100 hover:bg-neutral-200 hover:border-neutral-475'
                      : 'border-neutral-375 bg-white hover:bg-neutral-200 hover:border-neutral-475')
                }
              >
                <span
                  className={
                    'text-[13px] leading-none w-[22px] h-[22px] flex items-center justify-center rounded-full self-start ' +
                    (isToday ? 'bg-neutral-825 text-white font-semibold' : 'text-neutral-750 font-medium')
                  }
                >
                  {day}
                </span>
                {logs.length > 0 && (
                  <span className="flex md:hidden flex-wrap gap-[3px] w-full">
                    {Array.from(new Set(logs.map((l) => (isEventWorklogClientId(l.clientId) ? EVENT_COLOR : colorOf(l.clientId))))).map((c, j) => (
                      <span key={j} className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: c }} />
                    ))}
                  </span>
                )}
                {logs.length > 0 && (
                  <span className="hidden md:flex flex-col gap-[3px] w-full overflow-hidden">
                    {logs.slice(0, maxPerCell).map((l, j) => (
                      <span key={j} className="flex items-center gap-[5px] min-w-0">
                        <span
                          className="w-[7px] h-[7px] rounded-full shrink-0"
                          style={{ background: isEventWorklogClientId(l.clientId) ? EVENT_COLOR : colorOf(l.clientId) }}
                        />
                        <span className="text-[11px] text-neutral-750 truncate">{labelFor(l.clientId, clientName)}</span>
                      </span>
                    ))}
                    {logs.length > maxPerCell && <span className="text-[10.5px] text-neutral-650 pl-[12px]">+{logs.length - maxPerCell} more</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {legend.length > 0 && (
          <div className="flex md:hidden flex-wrap gap-x-4 gap-y-2 mt-5">
            {legend.map((e) => (
              <span key={e.id} className="flex items-center gap-[6px]">
                <span className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: e.color }} />
                <span className="text-[12px] text-neutral-750">{e.label}</span>
              </span>
            ))}
          </div>
        )}

        <WorkedPerClient groups={groups} isWeek={isWeek} hoursPerDay={hoursPerDay} onOpenDay={openDay} onOpenTask={openTask} />
      </div>
    </div>
  );
}

type WorkedPerClientProps = {
  groups: ClientWorkGroup[];
  isWeek: boolean;
  hoursPerDay: number;
  onOpenDay: (date: string) => void;
  onOpenTask: (id: string) => void;
};

/** The visible period's work, one collapsed row per client: over a month the task
 * lists add up to far more than a screen, so a row stays a single line — dot, name,
 * hours, task count — until it's opened. Its tasks then unfold underneath, each
 * with the days it was touched. */
function WorkedPerClient({ groups, isWeek, hoursPerDay, onOpenDay, onOpenTask }: WorkedPerClientProps) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const totalHours = groups.reduce((sum, g) => sum + g.hours, 0);
  const daysOf = (hours: number) => (hoursPerDay ? num(Math.round((hours / hoursPerDay) * 100) / 100) : '0');
  const allOpen = groups.length > 0 && groups.every((g) => openIds.includes(g.id));
  const toggle = (id: string) => setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="mt-10">
      <div className="flex items-center gap-[10px] mb-[14px]">
        <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-675">{isWeek ? 'WORKED THIS WEEK' : 'WORKED THIS MONTH'}</span>
        {totalHours > 0 && (
          <span className="inline-flex items-center px-[9px] py-[2px] rounded-full bg-brand-225 border border-brand-350 text-brand-650 text-[11px] font-semibold">
            {num(totalHours)}h · {daysOf(totalHours)}d
          </span>
        )}
        {groups.length > 1 && (
          <button
            onClick={() => setOpenIds(allOpen ? [] : groups.map((g) => g.id))}
            className="ml-auto text-[12px] text-info bg-transparent border-none p-0 cursor-pointer hover:underline"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-[14px] text-neutral-625 italic">No time logged or tasks worked in this {isWeek ? 'week' : 'month'}.</div>
      ) : (
        <div className="border border-neutral-375 rounded-[14px] bg-white overflow-hidden">
          {groups.map((g, i) => {
            const open = openIds.includes(g.id);
            return (
              <div key={g.id} className={i > 0 ? 'border-t border-neutral-375' : ''}>
                <button
                  onClick={() => toggle(g.id)}
                  className={
                    'w-full flex items-center gap-[10px] px-[14px] py-[11px] border-none text-left cursor-pointer hover:bg-neutral-150 ' +
                    (open ? 'bg-neutral-100' : 'bg-transparent')
                  }
                >
                  <span className={'text-neutral-625 leading-none transition-transform ' + (open ? 'rotate-90' : '')}>›</span>
                  <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="font-semibold text-[14px] truncate">{g.name}</span>
                  <span className="ml-auto flex items-center gap-[10px] shrink-0">
                    {g.hours > 0 && (
                      <span className="text-[12.5px] text-neutral-700 tabular-nums">
                        {num(g.hours)}h · {daysOf(g.hours)}d
                      </span>
                    )}
                    {g.items.length > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-neutral-275 text-neutral-700 text-[12px] font-semibold">
                        {g.items.length}
                      </span>
                    )}
                  </span>
                </button>

                {open && (
                  <div className="px-2 pb-[8px] pl-[32px] bg-neutral-100">
                    {g.hours > 0 && (
                      <div className="px-2.5 pb-1 text-[12px] text-neutral-675 tabular-nums">
                        {num(g.hours)}h logged over {g.loggedDays} {g.loggedDays === 1 ? 'day' : 'days'}
                      </div>
                    )}
                    {g.items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-x-[10px] gap-y-1 py-[6px] px-2.5 rounded-lg hover:bg-neutral-225">
                        <button
                          onClick={() => onOpenTask(item.id)}
                          title="Open task"
                          className={
                            'text-[14px] text-left bg-transparent border-none p-0 cursor-pointer hover:underline ' +
                            (item.done ? 'text-neutral-700 line-through decoration-neutral-550' : 'text-neutral-825')
                          }
                        >
                          {item.title}
                        </button>
                        <span className="ml-auto flex flex-wrap gap-x-[8px] gap-y-1">
                          {item.dates.map((d) => (
                            <button
                              key={d}
                              onClick={() => onOpenDay(d)}
                              title="Open this day"
                              className="text-[12px] text-info bg-transparent border-none p-0 cursor-pointer tabular-nums hover:underline"
                            >
                              {fmtShort(d)}
                            </button>
                          ))}
                        </span>
                      </div>
                    ))}
                    {g.items.length === 0 && (
                      <div className="px-2.5 py-1 text-[13px] text-neutral-625 italic">No tasks marked as worked.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Display name for a worklog client id, resolving event pseudo-clients. */
function labelFor(clientId: string, clientName: (id: string) => string): string {
  return isEventWorklogClientId(clientId) ? formatEventTypeLabel(eventTypeFromClientId(clientId)) : clientName(clientId);
}
