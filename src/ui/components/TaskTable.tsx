// The table an open-task list is drawn as: one set of columns, shared by the
// header and every row below it, so the meta lines up down the page — a row with
// no due date leaves that column empty instead of pulling its tags leftwards.
//
// The layout lives here rather than in the row because it is a property of the
// *list*: a lane is reserved when any row in it uses that field, which is a
// question only something holding the whole list can answer. Views render this,
// never `WorklogTaskRow` directly.

import React, { useMemo } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import type { WorklogRow } from '../model';
import { cn, SectionLabel } from '../primitives';
import { sortDirectionLabels, type TaskSortDirection, type TaskSortKey } from '../utils';
import { WorklogTaskRow } from './WorklogTaskRow';

/** The order the list is in, and the reorder a column header fires. The same
 *  key flips direction; a new one starts ascending. Comes from
 *  `useTaskListFilter`, so a header click and the toolbar's picker are the same
 *  state — lists without a filter pass nothing and get no header. */
export interface TaskTableSort {
  key: TaskSortKey;
  dir: TaskSortDirection;
  onSort: (key: TaskSortKey) => void;
}

/** Which lanes this list reserves, and the `grid-template-columns` that draws
 *  them. Passed to every row, whose cells must match it one for one: a missing
 *  cell would slide everything after it into the wrong column. */
export interface TaskTableLayout {
  fold: boolean;
  worked: boolean;
  status: boolean;
  priority: boolean;
  progress: boolean;
  due: boolean;
  tags: boolean;
  link: boolean;
  cols: string;
}

// One width per lane, so the chips can only line up down a list if they don't
// depend on what the row above happened to carry.
//
// The meta lanes are `minmax(0, n)` rather than a flat `n`, and the title has a
// floor instead of taking whatever is left: at full width every lane gets its
// full size and the columns are exact, but in a ~650px card — the day view's
// middle column — the lanes give way together instead of squeezing the titles
// down to a dozen characters. Which is the right trade: a column is worth
// aligning, but not at the cost of the one thing every row must be readable by.
//
// Handed to `style` rather than a class because the lane set is a runtime
// answer — `grid-cols-[...]` assembled from it would compile, type, lint, and
// ship with no CSS, since Tailwind only emits what its source scan finds.
const LANE = {
  fold: '16px',
  done: '17px',
  worked: '17px',
  status: 'minmax(0,84px)',
  title: 'minmax(180px,1fr)',
  priority: 'minmax(0,76px)',
  progress: 'minmax(0,58px)',
  due: 'minmax(0,88px)',
  tags: 'minmax(0,140px)',
  link: '18px',
};

export function useTaskTableLayout(rows: WorklogRow[]): TaskTableLayout {
  const fold = rows.some((r) => r.foldSlot);
  const worked = rows.some((r) => !!r.onWorked);
  const status = rows.some((r) => !!r.status);
  const priority = rows.some((r) => !!r.priority);
  const progress = rows.some((r) => !!r.progress);
  const due = rows.some((r) => !!r.due);
  const tags = rows.some((r) => r.tags.length > 0 || !!r.repeat);
  const link = rows.some((r) => r.hasLink);
  return useMemo(
    () => ({
      fold,
      worked,
      status,
      priority,
      progress,
      due,
      tags,
      link,
      cols: [
        fold && LANE.fold,
        LANE.done,
        worked && LANE.worked,
        status && LANE.status,
        LANE.title,
        priority && LANE.priority,
        progress && LANE.progress,
        due && LANE.due,
        tags && LANE.tags,
        link && LANE.link,
      ]
        .filter(Boolean)
        .join(' '),
    }),
    [fold, worked, status, priority, progress, due, tags, link],
  );
}

/** One column label. Sortable ones say what the next click would do rather than
 *  what the current order is — the arrow already shows that. */
function Head({
  label,
  sortKey,
  sort,
  className,
}: {
  label: string;
  sortKey?: TaskSortKey;
  sort: TaskTableSort;
  className?: string;
}) {
  if (!sortKey) {
    return (
      <SectionLabel size="sm" className={className}>
        {label}
      </SectionLabel>
    );
  }
  const active = sort.key === sortKey;
  const labels = sortDirectionLabels(sortKey);
  const next = active && sort.dir === 'asc' ? labels.desc : labels.asc;
  const Arrow = active && sort.dir === 'desc' ? ChevronDownIcon : ChevronUpIcon;
  // Named for what the click does rather than for the column, which the visible
  // label already says — a button announced as "Due" gives no clue that pressing
  // it reorders the list.
  const action = `Sort by ${label.toLowerCase()} — ${next.toLowerCase()}`;
  return (
    <button
      onClick={() => sort.onSort(sortKey)}
      title={action}
      aria-label={action}
      className="group/head min-w-0 bg-transparent border-none p-0 cursor-pointer"
    >
      <SectionLabel
        size="sm"
        className={cn('gap-[3px] group-hover/head:text-neutral-825', active && 'text-neutral-825', className)}
      >
        <span className="truncate">{label}</span>
        <Arrow size={11} strokeWidth={2.5} className={cn('shrink-0', !active && 'opacity-0 group-hover/head:opacity-45')} />
      </SectionLabel>
    </button>
  );
}

/** The column strip. Wide rows only — a narrow list stacks its meta under each
 *  title, where a header would name columns that aren't there. */
function TaskTableHead({ layout, sort }: { layout: TaskTableLayout; sort: TaskTableSort }) {
  return (
    <div
      className="hidden @lg:grid items-center gap-[11px] px-2.5 pb-[7px] mb-[3px] border-b border-neutral-275"
      style={{ gridTemplateColumns: layout.cols }}
    >
      {layout.fold && <span />}
      <span />
      {layout.worked && <span />}
      {layout.status && <Head label="Status" sortKey="status" sort={sort} />}
      <Head label="Task" sortKey="title" sort={sort} />
      {layout.priority && <Head label="Priority" sortKey="priority" sort={sort} />}
      {layout.progress && <Head label="Sub" sort={sort} className="justify-end" />}
      {layout.due && <Head label="Due" sortKey="due" sort={sort} />}
      {layout.tags && <Head label="Tags" sort={sort} />}
      {layout.link && <span />}
    </div>
  );
}

/** `children` is what a call site puts *inside* the list — the pager under the
 *  day view's to-dos, the "nothing matches these filters" line under an empty
 *  one — so the card around it stays the view's own.
 *
 *  `layout` is for a view that splits one list across several cards (Overdue by
 *  client, Upcoming by horizon): built there from every row, it keeps the due
 *  dates in the same column from card to card, which is the point of columns.
 *  A single-card list leaves it out and gets its own. */
export function TaskTable({
  rows,
  sort,
  layout: shared,
  children,
}: {
  rows: WorklogRow[];
  sort?: TaskTableSort;
  layout?: TaskTableLayout;
  children?: React.ReactNode;
}) {
  const own = useTaskTableLayout(rows);
  const layout = shared ?? own;
  return (
    // The container every row's `@lg:` collapse keys off, so a list switches to
    // the stacked layout as a whole: rows measuring themselves would leave a
    // header naming columns the rows under it had already given up on.
    <div className="@container">
      {sort && rows.length > 0 && <TaskTableHead layout={layout} sort={sort} />}
      {rows.map((row) => (
        <WorklogTaskRow key={row.id} row={row} layout={layout} />
      ))}
      {children}
    </div>
  );
}
