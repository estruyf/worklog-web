import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthLabel } from '../../utils';

export interface TrendPoint {
  month: string; // YYYY-MM
  hours: number;
}

/** Total logged hours per month across all history; the currently selected month
 * is highlighted so the trend view doubles as a "where am I" indicator. */
export function MonthlyTrendChart({ data, selectedMonth }: { data: TrendPoint[]; selectedMonth: string }) {
  if (data.length < 2) {
    return null; // a single month is a table row, not a trend
  }
  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <div className="border border-neutral-400 rounded-[11px] px-[18px] py-[18px] mt-[26px]">
      <div className="text-[11px] font-bold tracking-[0.05em] text-neutral-675 mb-[14px]">HOURS PER MONTH</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6E7781' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#6E7781' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: '#F4F5F7' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
            formatter={(value) => [`${value}h`, 'Hours']}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {chartData.map((d) => (
              <Cell key={d.month} fill={d.month === selectedMonth ? '#E2BE2E' : '#D7DCE2'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
