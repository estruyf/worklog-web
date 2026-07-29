// Everything that has slipped: open tasks whose due date is behind today, plus
// what is due today, across every client and the general to-do bucket. The day
// overview shows the same overdue block for the day you're on; this view is the
// one place that answers "what am I late on" without picking a date first.

import React, { useMemo } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { collectOverdue, daysOverdue, formatDaysLate } from '../../model/overdue';
import type { Task } from '../../model/types';
import { WorklogTaskRow } from '../components';
import { useData } from '../context';
import type { ClientTaskGroup } from '../model';
import { clientIdOf, dueOn, isDone } from '../utils';
import { GroupCard } from './day-view';

/** Overdue tasks bucketed by client, most-overdue client first, plus the rows
 *  due today. A task that is both late and lands on today's recurrence counts
 *  as late only — it's one task, and the sharper framing wins. */
function useOverdueData() {
  const { tasks, today, colorOf, clientName, openRowsFor } = useData();

  const overdue = useMemo(() => collectOverdue(tasks, today), [tasks, today]);

  const groups = useMemo<ClientTaskGroup[]>(() => {
    const byClient = new Map<string, Task[]>();
    for (const t of overdue) {
      const list = byClient.get(clientIdOf(t));
      if (list) {
        list.push(t);
      } else {
        byClient.set(clientIdOf(t), [t]);
      }
    }
    // `overdue` arrives oldest-first, so insertion order already puts the client
    // sitting on the longest-overdue task at the top.
    return [...byClient.entries()].map(([id, list]) => ({
      id,
      name: clientName(id),
      color: colorOf(id),
      count: list.length,
      rows: openRowsFor(list),
    }));
  }, [overdue, clientName, colorOf, openRowsFor]);

  const dueTodayRows = useMemo(() => {
    const late = new Set(overdue.map((t) => t.id));
    return openRowsFor(tasks.filter((t) => !isDone(t) && !late.has(t.id) && dueOn(t, today)));
  }, [tasks, today, overdue, openRowsFor]);

  const worstDays = overdue.length ? daysOverdue(overdue[0], today) : 0;

  return { groups, overdueCount: overdue.length, dueTodayRows, worstDays };
}

export function OverdueView() {
  const { groups, overdueCount, dueTodayRows, worstDays } = useOverdueData();

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] mx-auto">
        <div className="flex flex-wrap items-center gap-[10px] mb-6">
          <TriangleAlertIcon size={20} className={overdueCount > 0 ? 'text-danger-675' : 'text-neutral-650'} />
          <h1 className="text-[24px] font-bold m-0">Overdue</h1>
          <span className="text-[13px] text-neutral-675">
            {overdueCount === 0
              ? 'nothing late'
              : `${overdueCount} task${overdueCount === 1 ? '' : 's'} · worst ${formatDaysLate(worstDays).toLowerCase()}`}
          </span>
        </div>

        {overdueCount === 0 ? (
          <div className="text-[14px] text-neutral-625 italic">
            Nothing is past its due date. Tasks land here the day after they were due — including a recurring one
            that fell on a weekend and is still waiting.
          </div>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              cardClassName="border border-danger-200 rounded-[14px] bg-white mb-[14px] overflow-hidden"
              headerClassName="flex items-center gap-[9px] px-[18px] py-[13px] bg-danger-75 border-b border-danger-200 whitespace-nowrap"
              countBadgeClassName="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-danger-100 border border-danger-200 text-danger-675 text-[12px] font-semibold"
            />
          ))
        )}

        {dueTodayRows.length > 0 && (
          <>
            <div className="flex items-center gap-[10px] mt-9 mb-3">
              <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-675">DUE TODAY</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-[6px] rounded-full bg-neutral-325 text-neutral-675 text-[12px] font-semibold">
                {dueTodayRows.length}
              </span>
            </div>
            <div className="border border-neutral-375 rounded-[14px] bg-white px-2 py-[6px]">
              {dueTodayRows.map((row) => (
                <WorklogTaskRow key={row.id} row={row} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
