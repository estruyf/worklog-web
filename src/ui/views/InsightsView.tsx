import React, { useMemo } from 'react';
import type { MonthlyRow } from '../model';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import { monthLabel, num } from '../utils';
import { HoursByClientChart } from '../components/charts/HoursByClientChart';
import { MonthlyTrendChart, type TrendPoint } from '../components/charts/MonthlyTrendChart';
import { isEventWorklogClientId } from '../../model/worklog';

/** Rolls up the selected month's worklog into per-client hours/days rows. */
function useInsightsData() {
  const { worklog, clientName, colorOf, hoursPerDay, typeLabel } = useData();
  const { month } = useUi();

  const monthsList = useMemo(() => {
    const list = Array.from(new Set(worklog.map((w) => w.date.slice(0, 7)))).sort().reverse();
    if (!list.includes(month)) {
      list.unshift(month);
    }
    return list;
  }, [worklog, month]);
  const { monthlyRows, totalHours, clientCount, eventRows, eventTotalHours, eventTotalDays } = useMemo(() => {
    const clientAgg: Record<string, { hours: number; dayHours: Record<string, number> }> = {};
    const eventAgg: Record<string, { hours: number; dayHours: Record<string, number> }> = {};

    worklog
      .filter((w) => w.date.startsWith(month))
      .forEach((w) => {
        const target = isEventWorklogClientId(w.clientId) ? eventAgg : clientAgg;
        if (!target[w.clientId]) {
          target[w.clientId] = { hours: 0, dayHours: {} };
        }
        target[w.clientId].hours += w.hours;
        target[w.clientId].dayHours[w.date] = (target[w.clientId].dayHours[w.date] ?? 0) + w.hours;
      });

    const toRows = (agg: Record<string, { hours: number; dayHours: Record<string, number> }>, annotatePartialDays: boolean): MonthlyRow[] =>
      Object.keys(agg).map((cid) => {
        const item = agg[cid];
        return {
          name: clientName(cid),
          color: colorOf(cid),
          hours: item.hours,
          days: num(item.hours / hoursPerDay),
          dates: Object.keys(item.dayHours)
            .sort()
            .map((date) => {
              const dayHours = item.dayHours[date];
              const day = date.split('-')[2];
              const label = annotatePartialDays && dayHours < hoursPerDay ? `${day} (${typeLabel(dayHours)})` : day;
              return { date, label };
            }),
        };
      });

    const clientRows = toRows(clientAgg, true);
    const monthEventRows = toRows(eventAgg, false);
    const clientHours = clientRows.reduce((sum, row) => sum + row.hours, 0);
    const monthEventHours = monthEventRows.reduce((sum, row) => sum + row.hours, 0);
    return {
      monthlyRows: clientRows,
      totalHours: clientHours,
      clientCount: clientRows.length,
      eventRows: monthEventRows,
      eventTotalHours: monthEventHours,
      eventTotalDays: num(monthEventHours / hoursPerDay),
    };
  }, [worklog, month, clientName, colorOf, hoursPerDay, typeLabel]);

  const trend = useMemo<TrendPoint[]>(() => {
    const byMonth: Record<string, number> = {};
    worklog.forEach((w) => {
      const m = w.date.slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + w.hours;
    });
    return Object.keys(byMonth)
      .sort()
      .map((m) => ({ month: m, hours: Math.round(byMonth[m] * 10) / 10 }));
  }, [worklog]);

  return {
    monthsList,
    monthlyRows,
    totalHours,
    clientCount,
    totalDays: num(totalHours / hoursPerDay),
    eventRows,
    eventTotalHours,
    eventTotalDays,
    hoursPerDay,
    trend,
  };
}

export function InsightsView() {
  const { month, setMonth, setSelectedDate } = useUi();
  const { monthsList, monthlyRows, totalHours, clientCount, totalDays, eventRows, eventTotalHours, eventTotalDays, hoursPerDay, trend } = useInsightsData();
  const onOpenDate = (d: string) => {
    navigateToView('day');
    setSelectedDate(d);
  };
  return (
    <div className="flex-1 overflow-auto px-6 py-[34px]">
      <div className="max-w-[820px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[24px] font-bold m-0">Insights</h1>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 border border-neutral-525 rounded-lg text-[14px] bg-white cursor-pointer">
            {monthsList.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-[14px] mb-[26px]">
          <div className="bg-neutral-225 rounded-[11px] px-5 py-[18px]">
            <div className="text-[13px] text-neutral-675 mb-2">Clients</div>
            <div className="text-[28px] font-bold">{clientCount}</div>
          </div>
          <div className="bg-neutral-225 rounded-[11px] px-5 py-[18px]">
            <div className="text-[13px] text-neutral-675 mb-2">Total hours</div>
            <div className="text-[28px] font-bold">{totalHours}</div>
          </div>
          <div className="bg-neutral-225 rounded-[11px] px-5 py-[18px]">
            <div className="text-[13px] text-neutral-675 mb-2">Total days</div>
            <div className="text-[28px] font-bold">{totalDays}</div>
          </div>
        </div>

        <HoursByClientChart rows={monthlyRows} />

        <div className="border border-neutral-400 rounded-[11px] overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px] py-3 bg-neutral-150 border-b border-neutral-400 text-[11px] font-bold tracking-[0.05em] text-neutral-675">
            <span>CLIENT</span>
            <span className="text-right">HOURS</span>
            <span className="text-right">DAYS</span>
            <span className="pl-[14px]">DATES</span>
          </div>
          {monthlyRows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px] py-[13px] border-b border-neutral-275 items-center text-[14px]">
              <span className="flex items-center gap-[9px]">
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="text-right tabular-nums">{r.hours}</span>
              <span className="text-right tabular-nums">{r.days}</span>
              <div className="pl-[14px] flex flex-wrap gap-2">
                {r.dates.map((d, idx) => (
                  <span key={d.date}>
                    <a onClick={() => onOpenDate(d.date)} className="text-info cursor-pointer tabular-nums hover:underline">
                      {d.label}
                    </a>
                    {idx < r.dates.length - 1 && <span className="text-neutral-675">,</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {monthlyRows.length === 0 && <div className="px-[18px] py-[13px] text-[14px] text-neutral-625 italic">No time logged this month.</div>}
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px] py-[13px] bg-neutral-75 text-[14px] font-bold">
            <span>Total</span>
            <span className="text-right tabular-nums">{totalHours}</span>
            <span className="text-right tabular-nums">{totalDays}</span>
            <span />
          </div>
        </div>

        {eventRows.length > 0 && (
          <div className="border border-neutral-400 rounded-[11px] overflow-hidden mt-[18px]">
            <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px] py-3 bg-neutral-150 border-b border-neutral-400 text-[11px] font-bold tracking-[0.05em] text-neutral-675">
              <span>EVENT</span>
              <span className="text-right">HOURS</span>
              <span className="text-right">DAYS</span>
              <span className="pl-[14px]">DATES</span>
            </div>
            {eventRows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px] py-[13px] border-b border-neutral-275 items-center text-[14px]">
                <span className="flex items-center gap-[9px]">
                  <span className="w-[9px] h-[9px] rounded-full" style={{ background: r.color }} />
                  {r.name}
                </span>
                <span className="text-right tabular-nums">{r.hours}</span>
                <span className="text-right tabular-nums">{r.days}</span>
                <div className="pl-[14px] flex flex-wrap gap-2">
                  {r.dates.map((d, idx) => (
                    <span key={d.date}>
                      <a onClick={() => onOpenDate(d.date)} className="text-info cursor-pointer tabular-nums hover:underline">
                        {d.label}
                      </a>
                      {idx < r.dates.length - 1 && <span className="text-neutral-675">,</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_2.6fr] gap-3 px-[18px] py-[13px] bg-neutral-75 text-[14px] font-bold">
              <span>Total events</span>
              <span className="text-right tabular-nums">{eventTotalHours}</span>
              <span className="text-right tabular-nums">{eventTotalDays}</span>
              <span />
            </div>
          </div>
        )}
        <div className="text-[13px] text-neutral-625 mt-[14px]">Days derived as hours / {hoursPerDay} (hoursPerDay). Click a date to open that day.</div>

        <MonthlyTrendChart data={trend} selectedMonth={month} />
      </div>
    </div>
  );
}
