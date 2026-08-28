// Everything that has slipped: open tasks whose due date is behind today, plus
// what is due today, across every client and the general to-do bucket. The day
// overview shows the same overdue block for the day you're on; this view is the
// one place that answers "what am I late on" without picking a date first.

import React, { useMemo } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { collectOverdue, daysOverdue, formatDaysLate } from '../../model/overdue';
import type { Task } from '../../model/types';
import { TaskListToolbar, TaskTable, TaskTableGroups, useTaskTableLayout } from '../components';
import { Badge, Card, EmptyState, LinkButton, SectionLabel, ViewHeader } from '../primitives';
import { useData } from '../context';
import type { ClientTaskGroup } from '../model';
import { clientIdOf, dueOn, isDone, topLevelTasks } from '../utils';
import { useTaskListFilter } from '../hooks';
import { GroupCard } from './day-view';

/** Overdue tasks bucketed by client, most-overdue client first, plus the rows
 *  due today. A task that is both late and lands on today's recurrence counts
 *  as late only — it's one task, and the sharper framing wins.
 *
 *  One toolbar narrows both halves. The filter's *sort* applies within each
 *  client card; the cards themselves stay in longest-overdue-first order, which
 *  is the ranking this view exists for. */
function useOverdueData() {
  const { tasks, today, colorOf, clientName, openRowsFor } = useData();

  const overdue = useMemo(() => collectOverdue(tasks, today), [tasks, today]);
  const lateIds = useMemo(() => new Set(overdue.map((t) => t.id)), [overdue]);
  const dueToday = useMemo(
    () => tasks.filter((t) => !isDone(t) && !lateIds.has(t.id) && dueOn(t, today)),
    [tasks, today, lateIds],
  );

  const all = useMemo(() => [...overdue, ...dueToday], [overdue, dueToday]);
  const filter = useTaskListFilter(all, { label: 'overdue tasks' });

  const groups = useMemo<ClientTaskGroup[]>(() => {
    const order = new Map(filter.tasks.map((t, i) => [t.id, i]));
    const byClient = new Map<string, Task[]>();
    // Walked in `overdue` order (oldest-first), so insertion order still puts the
    // client sitting on the longest-overdue task at the top whatever the sort.
    for (const t of overdue) {
      if (!order.has(t.id)) {
        continue;
      }
      const list = byClient.get(clientIdOf(t));
      if (list) {
        list.push(t);
      } else {
        byClient.set(clientIdOf(t), [t]);
      }
    }
    return [...byClient.entries()].map(([id, list]) => ({
      id,
      name: clientName(id),
      color: colorOf(id),
      count: topLevelTasks(list).length,
      rows: openRowsFor([...list].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), filter.expanded),
    }));
  }, [overdue, filter.tasks, filter.expanded, clientName, colorOf, openRowsFor]);

  const dueTodayRows = useMemo(
    () => openRowsFor(filter.tasks.filter((t) => !lateIds.has(t.id)), filter.expanded),
    [filter.tasks, filter.expanded, lateIds, openRowsFor],
  );

  const worstDays = overdue.length ? daysOverdue(overdue[0], today) : 0;

  return { groups, overdueCount: overdue.length, dueTodayRows, worstDays, filter };
}

export function OverdueView() {
  const { groups, overdueCount, dueTodayRows, worstDays, filter } = useOverdueData();
  // One column set for the whole page: the client cards and the due-today card
  // are one list the view happened to split up, and columns that moved between
  // them would say they weren't.
  const rows = useMemo(() => [...groups.flatMap((g) => g.rows), ...dueTodayRows], [groups, dueTodayRows]);
  const layout = useTaskTableLayout(rows);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex flex-wrap items-center gap-[10px]">
        <TriangleAlertIcon size={20} className={overdueCount > 0 ? 'text-danger-675' : 'text-neutral-650'} />
        <h1 className="text-[24px] font-bold m-0">Overdue</h1>
        <span className="text-control text-neutral-675">
          {overdueCount === 0
            ? 'nothing late'
            : `${overdueCount} task${overdueCount === 1 ? '' : 's'} · worst ${formatDaysLate(worstDays).toLowerCase()}`}
        </span>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {filter.toolbar && <TaskListToolbar {...filter.toolbar} surface="page" />}
          {overdueCount === 0 ? (
            <EmptyState>
              Nothing is past its due date. Tasks land here the day after they were due — including a recurring one
              that fell on a weekend and is still waiting.
            </EmptyState>
          ) : groups.length === 0 ? (
            <EmptyState>
              No overdue tasks match these filters.{' '}
              <LinkButton size="inherit" onClick={filter.reset} className="italic underline">
                Reset
              </LinkButton>
            </EmptyState>
          ) : (
            <TaskTableGroups layout={layout} sort={filter.sort}>
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} tone="overdue" layout={layout} />
              ))}
            </TaskTableGroups>
          )}

          {dueTodayRows.length > 0 && (
            <>
              <div className="flex items-center gap-[10px] mt-9 mb-3">
                <SectionLabel>Due today</SectionLabel>
                <Badge>{dueTodayRows.length}</Badge>
              </div>
              <Card padding="list">
                <TaskTable rows={dueTodayRows} sort={filter.sort} layout={layout} />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
