// The table an open-task list is drawn as: one set of columns, shared by the
// header and every row below it, so the meta lines up down the page — a row with
// no due date leaves that column empty instead of pulling its tags leftwards.
//
// The layout lives here rather than in the row because it is a property of the
// *list*: a lane is reserved when any row in it uses that field, which is a
// question only something holding the whole list can answer. Views render
// `TaskTable` (one card) or `TaskTableGroups` + `TaskRows` (a card per client),
// never `WorklogTaskRow` directly.

import React, { useMemo } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
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
 *  cell would slide everything after it into the wrong column.
 *
 *  Two templates, because one lane is width-dependent: `cols` has no tags lane
 *  and `colsWide` does. They are handed down as CSS variables and switched by a
 *  container query — see the row. */
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
  colsWide: string;
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
// Handed down as CSS variables rather than as a class because the lane set is a
// runtime answer — `grid-cols-[...]` assembled from it would compile, type, lint,
// and ship with no CSS, since Tailwind only emits what its source scan finds. The
// classes that *read* those variables are literal, so they do get emitted.
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

/** The two templates as custom properties, for the classes that pick between
 *  them. Cast because `CSSProperties` has no room for a variable. */
export function tableColumnVars(layout: TaskTableLayout): React.CSSProperties {
  return { '--cols': layout.cols, '--cols-wide': layout.colsWide } as React.CSSProperties;
}

export function useTaskTableLayout(rows: WorklogRow[]): TaskTableLayout {
  const fold = rows.some((r) => r.foldSlot);
  const worked = rows.some((r) => !!r.onWorked);
  const status = rows.some((r) => !!r.status);
  const priority = rows.some((r) => !!r.priority);
  const progress = rows.some((r) => !!r.progress);
  const due = rows.some((r) => !!r.due);
  const tags = rows.some((r) => r.tags.length > 0 || !!r.repeat);
  const link = rows.some((r) => r.hasLink);
  return useMemo(() => {
    const lanes = (withTags: boolean) =>
      [
        fold && LANE.fold,
        LANE.done,
        worked && LANE.worked,
        status && LANE.status,
        LANE.title,
        priority && LANE.priority,
        progress && LANE.progress,
        due && LANE.due,
        withTags && LANE.tags,
        link && LANE.link,
      ]
        .filter(Boolean)
        .join(' ');
    return {
      fold,
      worked,
      status,
      priority,
      progress,
      due,
      tags,
      link,
      cols: lanes(false),
      colsWide: lanes(tags),
    };
  }, [fold, worked, status, priority, progress, due, tags, link]);
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
      <SectionLabel size="sm" tone="faint" className={className}>
        {label}
      </SectionLabel>
    );
  }
  const active = sort.key === sortKey;
  const labels = sortDirectionLabels(sortKey);
  const next = active && sort.dir === 'asc' ? labels.desc : labels.asc;
  // The same arrow the toolbar's direction button wears, so the two read as one
  // control: the header is where the order is shown once a column carries it.
  const Arrow = active && sort.dir === 'desc' ? ArrowDownIcon : ArrowUpIcon;
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
      {/* The active column states its own colour: `text-neutral-825` is declared
          after the tone's `text-neutral-600`, so it wins — the other way round
          `cn` could not have overridden it. */}
      <SectionLabel
        size="sm"
        tone="faint"
        className={cn('gap-[3px] group-hover/head:text-neutral-825', active && 'text-neutral-825', className)}
      >
        <span className="truncate">{label}</span>
        <Arrow size={10} strokeWidth={2.75} className={cn('shrink-0', !active && 'opacity-0 group-hover/head:opacity-45')} />
      </SectionLabel>
    </button>
  );
}

/** The column strip. Wide rows only — a narrow list stacks its meta under each
 *  title, where a header would name columns that aren't there.
 *
 *  `className` is the inset: inside a card the strip sits at the rows' own
 *  padding, while a strip *above* a stack of cards has to clear the card's
 *  border and padding as well to land on the same column. */
function TaskTableHead({
  layout,
  sort,
  className = 'px-2.5',
}: {
  layout: TaskTableLayout;
  sort: TaskTableSort;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'hidden @lg:grid @lg:[grid-template-columns:var(--cols)] @4xl:[grid-template-columns:var(--cols-wide)] items-center gap-[11px] pb-[7px] mb-[3px]',
        className,
      )}
      style={tableColumnVars(layout)}
    >
      {layout.fold && <span />}
      <span />
      {layout.worked && <span />}
      {layout.status && <Head label="Status" sortKey="status" sort={sort} />}
      <Head label="Task" sortKey="title" sort={sort} />
      {layout.priority && <Head label="Priority" sortKey="priority" sort={sort} />}
      {layout.progress && <Head label="Sub" sort={sort} className="justify-end" />}
      {layout.due && <Head label="Due" sortKey="due" sort={sort} />}
      {/* Only a lane from @4xl up — below that the tags ride behind the title,
          where a column header naming them would point at nothing. */}
      {layout.tags && (
        <span className="hidden @4xl:block">
          <Head label="Tags" sort={sort} />
        </span>
      )}
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
      <TaskRows rows={rows} layout={layout} />
      {children}
    </div>
  );
}

/** Just the rows, for a list whose container and column header belong to
 *  something above it — see `TaskTableGroups`. */
export function TaskRows({ rows, layout }: { rows: WorklogRow[]; layout: TaskTableLayout }) {
  return rows.map((row) => <WorklogTaskRow key={row.id} row={row} layout={layout} />);
}

/** One list broken into cards — a card per client — under a single column
 *  header.
 *
 *  It owns the `@container` rather than each card doing so, which is what makes
 *  the header honest: the strip and every card's rows then answer the *same*
 *  width, and cannot disagree about whether there is a tags column. The header
 *  also has to be here and not in the cards, because it names columns the cards
 *  share — one per card would be the same four words four times. */
export function TaskTableGroups({
  layout,
  sort,
  children,
}: {
  layout: TaskTableLayout;
  sort?: TaskTableSort;
  children: React.ReactNode;
}) {
  return (
    <div className="@container">
      {/* Clears the card's border and its two paddings (1 + 8 + 10), so a label
          sits over the column it names rather than over the card's edge. */}
      {sort && <TaskTableHead layout={layout} sort={sort} className="px-[19px]" />}
      {children}
    </div>
  );
}
