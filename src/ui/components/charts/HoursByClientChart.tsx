import React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyRow } from '../../model';
import { Card, SectionLabel } from '../../primitives';

/** Horizontal bar chart of hours per client for the selected month. Each bar is
 * tinted with the client's own accent color (already resolved on the row). */
export function HoursByClientChart({ rows }: { rows: MonthlyRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  const data = [...rows].sort((a, b) => b.hours - a.hours);
  // ~34px per row keeps bars readable whether there are 2 clients or 12.
  const height = Math.max(120, data.length * 34 + 24);
  return (
    <Card className="px-[18px] py-[18px] mb-[26px]">
      <SectionLabel className="mb-[14px]">Hours by client</SectionLabel>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6E7781' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: '#3C4149' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#F4F5F7' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
            formatter={(value) => [`${value}h`, 'Hours']}
          />
          <Bar dataKey="hours" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
