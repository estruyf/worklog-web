import React, { useMemo } from 'react';
import type { MonthlyRow } from '../model';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import { EVENT_COLOR, num } from '../utils';
import { HoursByClientChart } from '../components/charts/HoursByClientChart';
import { MonthlyTrendChart, type TrendPoint } from '../components/charts/MonthlyTrendChart';
import { isEventWorklogClientId } from '../../model/worklog';
import { HoursTable, MonthPicker, StatTile } from './insights-view';

/** Rolls up the selected month's worklog into per-client hours/days rows. */
function useInsightsData() {
  const { worklog, clientName, colorOf, hoursPerDay, typeLabel } = useData();
  const { month } = useUi();

  // Hours per YYYY-MM: the month picker's captions and the trend chart's points
  // are the same rollup, so it is derived once.
  const hoursByMonth = useMemo(() => {
    const byMonth: Record<string, number> = {};
    worklog.forEach((w) => {
      const m = w.date.slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + w.hours;
    });
    Object.keys(byMonth).forEach((m) => {
      byMonth[m] = Math.round(byMonth[m] * 10) / 10;
    });
    return byMonth;
  }, [worklog]);

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
          color: isEventWorklogClientId(cid) ? EVENT_COLOR : colorOf(cid),
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

  const trend = useMemo<TrendPoint[]>(
    () =>
      Object.keys(hoursByMonth)
        .sort()
        .map((m) => ({ month: m, hours: hoursByMonth[m] })),
    [hoursByMonth],
  );

  return {
    hoursByMonth,
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
  const { today } = useData();
  const { hoursByMonth, monthlyRows, totalHours, clientCount, totalDays, eventRows, eventTotalHours, eventTotalDays, hoursPerDay, trend } = useInsightsData();
  const onOpenDate = (d: string) => {
    navigateToView('day');
    setSelectedDate(d);
  };
  return (
    <div className="flex-1 overflow-auto px-6 py-[34px]">
      <div className="max-w-[920px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="text-[24px] font-bold m-0">Insights</h1>
          <MonthPicker
            value={month}
            onChange={setMonth}
            hoursByMonth={hoursByMonth}
            currentMonth={today.slice(0, 7)}
            className="self-start md:self-auto"
          />
        </div>

        <div className="grid grid-cols-3 gap-[14px] mb-[26px]">
          <StatTile label="Clients" value={clientCount} />
          <StatTile label="Total hours" value={totalHours} />
          <StatTile label="Total days" value={totalDays} />
        </div>

        <HoursByClientChart rows={monthlyRows} />

        <HoursTable
          heading="Client"
          rows={monthlyRows}
          totalLabel="Total"
          totalHours={totalHours}
          totalDays={totalDays}
          onOpenDate={onOpenDate}
          empty="No time logged this month."
        />

        {/* Events are their own table rather than more rows: they are not clients,
            and folding them in would double-count the month's total. */}
        {eventRows.length > 0 && (
          <HoursTable
            heading="Event"
            rows={eventRows}
            totalLabel="Total events"
            totalHours={eventTotalHours}
            totalDays={eventTotalDays}
            onOpenDate={onOpenDate}
            className="mt-[18px]"
          />
        )}
        <div className="text-control text-neutral-625 mt-[14px]">Days derived as hours / {hoursPerDay} (hoursPerDay). Click a date to open that day.</div>

        <MonthlyTrendChart data={trend} selectedMonth={month} />
      </div>
    </div>
  );
}
