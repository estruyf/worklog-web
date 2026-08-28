import React from 'react';
import type { WorklogRow } from '../model';
import { CalendarIcon, CheckIcon, EllipsisIcon, EyeIcon, GlobeIcon, Pencil, RefreshCwIcon, Trash } from 'lucide-react';
import { formatDaysLate } from '../../model/overdue';
import { Button, Chip, Menu } from '../primitives';
import { fmtShort } from '../utils';
import { DisclosureIcon } from './icons';
import { PriorityChip } from './PriorityChip';
import { StatusPicker } from './StatusPicker';
import { tableColumnVars, type TaskTableLayout } from './TaskTable';
import { WorkedToggle } from './WorkedToggle';

/** The fold toggle, or the space it would take. Within a list that nests, rows
 *  without subtasks render the spacer rather than nothing, so every title starts
 *  at the same x — a chevron that shifted its neighbours would be worse than no
 *  chevron. A list where nothing nests (`slot` false) drops the column entirely
 *  instead of indenting every row around a toggle it will never draw. */
function FoldToggle({ slot, collapsed, onToggle }: { slot: boolean; collapsed?: boolean; onToggle?: () => void }) {
  if (!slot) {
    return null;
  }
  if (!onToggle) {
    return <span className="w-4 shrink-0" aria-hidden="true" />;
  }
  return (
    <button
      onClick={onToggle}
      aria-expanded={!collapsed}
      title={collapsed ? 'Show subtasks' : 'Hide subtasks'}
      className="w-4 h-4 shrink-0 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-neutral-625 hover:text-neutral-825"
    >
      <DisclosureIcon open={!collapsed} size={11} />
    </button>
  );
}

/** Subtask completion rollup, shown inline on desktop and below the title on
 * mobile. `barWidth` shrinks the meter to match the narrower mobile row. */
function ProgressChip({ progress, barWidth }: { progress: NonNullable<WorklogRow['progress']>; barWidth: number }) {
  return (
    <span
      title={`${progress.done} of ${progress.total} subtasks done`}
      className="shrink-0 flex items-center gap-[6px] text-eyebrow text-neutral-675 tabular-nums"
    >
      <span className="h-[5px] rounded-full bg-neutral-375 overflow-hidden" style={{ width: barWidth }}>
        <span className="block h-full bg-success-500" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </span>
      {progress.done}/{progress.total}
    </span>
  );
}

/** The due date, red once it has passed. An overdue chip also carries how far
 *  past it is — "1 Aug · 3d" — since on a late task the date alone doesn't say
 *  whether it slipped overnight or a fortnight ago. */
function DueChip({ due, overdue, days }: { due: string; overdue: boolean; days?: number }) {
  return (
    <span
      title={overdue ? `${formatDaysLate(days ?? 0)} — was due ${due}` : `Due ${due}`}
      className={
        'shrink-0 flex items-center gap-[4px] text-eyebrow font-semibold px-[7px] py-[2px] rounded-full ' +
        (overdue ? 'text-danger-675 bg-danger-75 border border-danger-200' : 'text-neutral-675 bg-neutral-250 border border-neutral-400')
      }
    >
      <CalendarIcon size={10} strokeWidth={1.6} />
      {fmtShort(due)}
      {overdue && !!days && <span className="opacity-80">· {days}d</span>}
    </span>
  );
}

/** Marks a task that rolls onto a new occurrence when completed, rather than
 *  disappearing into the archive. `title` carries the rule in words. */
function RepeatChip({ label }: { label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="shrink-0 flex items-center gap-[4px] text-eyebrow font-semibold px-[7px] py-[2px] rounded-full text-brand-800 bg-brand-175 border border-brand-375"
    >
      <RefreshCwIcon size={9} strokeWidth={2.4} />
      Repeats
    </span>
  );
}

/** Tag chips. Clickable when the row supplies `onTagClick`, which opens the
 * tag-filtered search — otherwise plain labels. */
function TagChips({ tags, onTagClick, truncate }: { tags: string[]; onTagClick?: (tag: string) => void; truncate?: boolean }) {
  return (
    <>
      {tags.map((tag) =>
        onTagClick ? (
          <Chip
            key={tag}
            variant="tag"
            truncate={truncate}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(tag);
            }}
            title={`Show everything tagged "${tag}"`}
          >
            {tag}
          </Chip>
        ) : (
          <Chip key={tag} variant="tag" as="span" truncate={truncate} title={tag}>
            {tag}
          </Chip>
        ),
      )}
    </>
  );
}

/** What a wide row shows of its tags: the repeat marker, one tag, and a count of
 *  whatever else the task carries — the rest is a hover away, and the narrow
 *  layout below wraps and shows the lot. One rather than as many as fit, because
 *  the run gives way in a narrow pane and two chips sharing 90px are two chips
 *  you can't read. The one that is shown ellipsizes rather than being cut
 *  through by the edge it runs into: a chip sliced in half reads as a fault. */
function TagRun({ row }: { row: WorklogRow }) {
  const shown = row.tags.slice(0, 1);
  const hidden = row.tags.slice(shown.length);
  return (
    <>
      {row.repeat && <RepeatChip label={row.repeat} />}
      <TagChips tags={shown} onTagClick={row.onTagClick} truncate />
      {hidden.length > 0 && (
        <span title={hidden.join(', ')} className="shrink-0 text-eyebrow text-neutral-675 tabular-nums">
          +{hidden.length}
        </span>
      )}
    </>
  );
}

function LinkChip({ link, size }: { link: string; size: number }) {
  return (
    <a href={link} target="_blank" rel="noreferrer noopener" className="text-neutral-625 shrink-0 leading-[0] hover:text-info" title={link}>
      <GlobeIcon style={{ width: size, height: size }} />
    </a>
  );
}

// How far the narrow row's meta line is indented to sit under the title: the
// buttons to its left, which is the fold slot (16px + its 11px gap) when the list
// reserves one, plus the done circle and — on rows that have it — the worked
// toggle. Written out per case rather than summed into an arbitrary value at
// runtime: Tailwind only emits classes its source scan finds.
const META_INDENT = {
  'slot-worked': 'pl-[72px]',
  'slot-plain': 'pl-[55px]',
  'flat-worked': 'pl-[45px]',
  'flat-plain': 'pl-[28px]',
};

// Memoized so a row skips re-rendering while its stable `row` object is
// unchanged — important because the task lists re-render on every keystroke in
// the surrounding views (log form, search box). `layout` is memoized by
// `TaskTable`, which is the only thing that renders this.
//
// From `@lg` (32rem) up the row is a grid: `layout.cols` gives every list one
// set of columns, so the chips line up down the page whether or not the row
// above carried the same fields. Every lane the layout reserves gets a cell
// here, empty or not — a skipped one would slide the rest of the row into the
// wrong column. From `@4xl` (56rem) it switches to `layout.colsWide`, which adds
// the tags lane the narrower band folds in behind the title.
//
// Below `@lg` the same cells are `hidden` and the row falls back to a flex line:
// the title wraps, the meta reflows onto a second line indented under it, and
// the hover actions become an overflow menu. It keys off the *list's* width (the
// container is on `TaskTable`), because the same row is used both full-width and
// in the day view's ~320px to-do side column.
export const WorklogTaskRow = React.memo(function WorklogTaskRow({ row, layout }: { row: WorklogRow; layout: TaskTableLayout }) {
  const hasNarrowMeta =
    !!row.status || !!row.priority || !!row.progress || !!row.due || !!row.repeat || row.tags.length > 0 || row.hasLink;
  return (
    <div key={row.id} className="group relative py-2 px-2.5 rounded-lg hover:bg-neutral-175">
      <div
        className="flex items-center gap-[11px] @lg:grid @lg:[grid-template-columns:var(--cols)] @4xl:[grid-template-columns:var(--cols-wide)]"
        style={tableColumnVars(layout)}
      >
        <FoldToggle slot={layout.fold} collapsed={row.collapsed} onToggle={row.onToggleCollapse} />
        {/* The visible circle stays 17px, but the tap target doesn't: the halo
            extends 8px up/down and 5px sideways — half the 11px gap to the worked
            toggle, so the two ticks meet at the midline rather than stealing each
            other's taps. Same treatment on `WorkedToggle`. */}
        <button onClick={row.onDone} title="Mark done" className="relative before:absolute before:-inset-y-2 before:-inset-x-[5px] w-[17px] h-[17px] shrink-0 border-[1.5px] border-neutral-575 rounded-full bg-white cursor-pointer p-0 text-neutral-500 hover:border-success-500 hover:text-success-500 flex items-center justify-center">
          <CheckIcon size={11} strokeWidth={2.5} />
        </button>
        {/* Worked toggle — absent for rows with no worked-on state (to-dos), which
            in a list that mixes the two still hold the lane open. */}
        {row.onWorked ? (
          <WorkedToggle
            worked={row.worked}
            onToggle={row.onWorked}
            title={row.workedTitle}
            label={row.workedLabel}
            ariaLabel={`${row.workedLabel} — ${row.title}`}
          />
        ) : (
          layout.worked && <span className="hidden @lg:block" aria-hidden="true" />
        )}
        {/* Status column — wide rows only; when narrow it moves to the meta row
            below. A custom status can be named anything, so a long one is cut off
            with its full name left on the trigger's title: in a table the column
            it would push out of shape belongs to every other row too. */}
        {layout.status && (
          <span className="hidden @lg:block min-w-0">
            {row.status && (
              <StatusPicker
                statusId={row.status.id}
                label={row.status.label}
                name={row.status.name}
                color={row.status.color}
                done={row.status.done}
                choices={row.status.choices}
                onSelect={row.status.onSelect}
                className="block max-w-full truncate"
              />
            )}
          </span>
        )}
        <div className="flex-1 min-w-0 flex items-center gap-[8px]">
          <button
            onClick={row.onView}
            title="View task"
            style={{ paddingLeft: row.indent }}
            className="text-row text-neutral-825 min-w-0 text-left bg-transparent border-none cursor-pointer p-0 hover:underline whitespace-normal leading-[1.35] @lg:whitespace-nowrap @lg:overflow-hidden @lg:text-ellipsis @lg:leading-normal"
          >
            {row.title}
          </button>
          {/* Between @lg and @4xl the tags give up their lane and ride behind the
              title: they are short and few, and 140px of them is 140px the
              titles need more. Everything else keeps its column. */}
          {layout.tags && (
            <span className="hidden @lg:flex @4xl:hidden items-center gap-[6px] min-w-0 overflow-hidden">
              <TagRun row={row} />
            </span>
          )}
        </div>
        {/* Inline meta — wide rows only. When narrow these reflow to the row below. */}
        {layout.priority && (
          <div className="hidden @lg:flex items-center min-w-0">{row.priority && <PriorityChip priority={row.priority} />}</div>
        )}
        {layout.progress && (
          <div className="hidden @lg:flex items-center justify-end min-w-0">
            {row.progress && <ProgressChip progress={row.progress} barWidth={32} />}
          </div>
        )}
        {layout.due && (
          <div className="hidden @lg:flex items-center min-w-0">
            {row.due && <DueChip due={row.due} overdue={row.overdue} days={row.overdueDays} />}
          </div>
        )}
        {layout.tags && (
          <div className="hidden @4xl:flex items-center gap-[6px] min-w-0 overflow-hidden">
            <TagRun row={row} />
          </div>
        )}
        {layout.link && (
          <div className="hidden @lg:flex items-center justify-center">{row.hasLink && <LinkChip link={row.link} size={14} />}</div>
        )}
        {/* Narrow rows have no room for the hover actions below, and hover
            doesn't exist on the touch screens most of them are on — so the same
            three actions live behind one overflow trigger instead of vanishing. */}
        <span className="@lg:hidden shrink-0">
          <Menu
            kind="action"
            align="end"
            label={`Actions for “${row.title}”`}
            options={[
              { id: 'view', label: 'View task', icon: <EyeIcon size={13} /> },
              { id: 'edit', label: 'Edit task', icon: <Pencil size={13} /> },
              { id: 'delete', label: 'Delete task', icon: <Trash size={13} /> },
            ]}
            onSelect={(id) => (id === 'view' ? row.onView() : id === 'edit' ? row.onEdit() : row.onDelete())}
            className="w-7 h-7 -my-1 flex items-center justify-center rounded-lg text-neutral-625 hover:text-neutral-825 hover:bg-neutral-250"
          >
            <EllipsisIcon size={16} />
          </Menu>
        </span>
      </div>

      {/* Hover actions — wide rows only, and laid over the row rather than in a
          lane of their own: three buttons' worth of width reserved on every row
          is width the titles need, and they are only ever wanted on the one row
          under the pointer. They stop short of the link column so following a
          link doesn't mean moving the mouse away first. */}
      <div
        className="hidden @lg:flex items-center gap-[6px] absolute top-1/2 -translate-y-1/2 bg-neutral-175 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto before:absolute before:right-full before:inset-y-0 before:w-6 before:bg-gradient-to-r before:from-transparent before:to-neutral-175"
        style={{ right: layout.link ? 39 : 10 }}
      >
        <Button size="xs" onClick={row.onView} title="View task">
          <EyeIcon size={12} />
          <span className="sr-only">View task</span>
        </Button>
        <Button size="xs" onClick={row.onEdit} title="Edit task">
          <Pencil size={12} />
          <span className="sr-only">Edit task</span>
        </Button>
        <Button size="xs" variant="danger" onClick={row.onDelete} title="Delete task">
          <Trash size={12} />
          <span className="sr-only">Delete task</span>
        </Button>
      </div>

      {/* Narrow-row meta — status + progress + due + tags + link, indented under
          the title by `META_INDENT`.
          Hidden from `@lg` up, and skipped entirely when there is nothing to show. */}
      {hasNarrowMeta && (
        <div
          className={
            'flex @lg:hidden flex-wrap items-center gap-x-[10px] gap-y-[6px] mt-[6px] ' +
            META_INDENT[`${layout.fold ? 'slot' : 'flat'}-${row.onWorked ? 'worked' : 'plain'}`]
          }
        >
          {row.status && (
            <StatusPicker
              statusId={row.status.id}
              label={row.status.label}
              name={row.status.name}
              color={row.status.color}
              done={row.status.done}
              choices={row.status.choices}
              onSelect={row.status.onSelect}
            />
          )}
          {row.priority && <PriorityChip priority={row.priority} />}
          {row.progress && <ProgressChip progress={row.progress} barWidth={38} />}
          {row.due && <DueChip due={row.due} overdue={row.overdue} days={row.overdueDays} />}
          {row.repeat && <RepeatChip label={row.repeat} />}
          <TagChips tags={row.tags} onTagClick={row.onTagClick} />
          {row.hasLink && <LinkChip link={row.link} size={13} />}
        </div>
      )}
    </div>
  );
});
