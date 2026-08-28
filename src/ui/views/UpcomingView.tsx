// Everything still ahead: open tasks with a due date past today, bucketed by how
// far off they are. The Overdue view answers "what am I late on"; this is the same
// question pointed the other way, and between them they cover every dated task —
// overdue takes the past and today, this one takes the future.

import React, { useMemo } from 'react';
import { CalendarClockIcon } from 'lucide-react';
import { collectUpcoming, daysUntil, formatDaysUntil, groupUpcoming } from '../../model/upcoming';
import { TaskListToolbar, TaskTable, useTaskTableLayout } from '../components';
import { Badge, Card, EmptyState, LinkButton, SectionLabel, ViewHeader } from '../primitives';
import { useData } from '../context';
import type { WorklogRow } from '../model';
import { useTaskListFilter } from '../hooks';

/** One horizon as the page renders it. */
interface UpcomingSection {
  id: string;
  label: string;
  rows: WorklogRow[];
}

/** The planned tasks, bucketed, with one toolbar narrowing the lot.
 *
 *  The buckets are built from what the filter left, so one narrowed to nothing
 *  disappears rather than sitting there empty. Their *order* is fixed — nearest
 *  horizon first is the whole point of the view — and the filter's sort applies
 *  within each bucket, the way it does inside the Overdue view's client cards. */
function useUpcomingData() {
  const { tasks, today, weekStart, openRowsFor } = useData();

  const upcoming = useMemo(() => collectUpcoming(tasks, today), [tasks, today]);
  const filter = useTaskListFilter(upcoming, { label: 'upcoming tasks' });

  const sections = useMemo<UpcomingSection[]>(() => {
    const order = new Map(filter.tasks.map((t, i) => [t.id, i]));
    return groupUpcoming(filter.tasks, today, weekStart).map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      rows: openRowsFor([...bucket.tasks].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), filter.expanded),
    }));
  }, [filter.tasks, filter.expanded, today, weekStart, openRowsFor]);

  const nextIn = upcoming.length ? daysUntil(upcoming[0], today) : 0;

  return { sections, total: upcoming.length, nextIn, filter };
}

export function UpcomingView() {
  const { sections, total, nextIn, filter } = useUpcomingData();
  // The horizons are one list cut into buckets, so they share one column set —
  // a due date that moved column between "this week" and "later" would read as
  // a different kind of thing.
  const layout = useTaskTableLayout(useMemo(() => sections.flatMap((s) => s.rows), [sections]));

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex flex-wrap items-center gap-[10px]">
        <CalendarClockIcon size={20} className={`text-neutral-650`} />
        <h1 className="text-[24px] font-bold m-0">Upcoming</h1>
        <span className="text-control text-neutral-675">
          {total === 0
            ? 'nothing planned'
            : `${total} task${total === 1 ? '' : 's'} · next ${formatDaysUntil(nextIn).toLowerCase()}`}
        </span>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {total === 0 ? (
            <EmptyState>
              Nothing is due after today. Give a task a due date and it lands here until the day itself comes round —
              a recurring one shows its next occurrence, not the whole series.
            </EmptyState>
          ) : (
            <>
              {filter.toolbar && <TaskListToolbar {...filter.toolbar} surface="page" />}
              {sections.length === 0 ? (
                <EmptyState>
                  No upcoming tasks match these filters.{' '}
                  <LinkButton size="inherit" onClick={filter.reset} className="italic underline">
                    Reset
                  </LinkButton>
                </EmptyState>
              ) : (
                sections.map((section) => (
                  <div key={section.id} className="mb-9 last:mb-0">
                    <div className="flex items-center gap-[10px] mb-3">
                      <SectionLabel>{section.label}</SectionLabel>
                      <Badge>{section.rows.length}</Badge>
                    </div>
                    <Card padding="list">
                      <TaskTable rows={section.rows} sort={filter.sort} layout={layout} />
                    </Card>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
