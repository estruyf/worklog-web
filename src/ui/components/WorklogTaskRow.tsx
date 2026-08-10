import React from 'react';
import type { WorklogRow } from '../model';
import { BriefcaseIcon, CalendarIcon, GlobeIcon, RefreshCwIcon } from 'lucide-react';
import { formatDaysLate } from '../../model/overdue';
import { Button, Chip } from '../primitives';
import { fmtShort } from '../utils';
import { DisclosureIcon } from './icons';
import { PriorityChip } from './PriorityChip';
import { StatusPicker } from './StatusPicker';

/** The fold toggle, or the space it would take. Rows without subtasks render the
 *  spacer rather than nothing, so every title in a list starts at the same x —
 *  a chevron that shifted its neighbours would be worse than no chevron. */
function FoldToggle({ collapsed, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
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
function TagChips({ tags, onTagClick }: { tags: string[]; onTagClick?: (tag: string) => void }) {
  return (
    <>
      {tags.map((tag) =>
        onTagClick ? (
          <Chip
            key={tag}
            variant="tag"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(tag);
            }}
            title={`Show everything tagged "${tag}"`}
          >
            {tag}
          </Chip>
        ) : (
          <Chip key={tag} variant="tag" as="span">
            {tag}
          </Chip>
        ),
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

// Memoized so a row skips re-rendering while its stable `row` object is
// unchanged — important because the task lists re-render on every keystroke in
// the surrounding views (log form, search box).
//
// The row collapses gracefully when it is narrower than `@lg` (32rem): the
// status column and hover actions drop out, the title is allowed to wrap, and
// the metadata (status, progress, due, tags, link) reflows onto a second line
// indented under the title. It keys off the row's own width rather than the
// viewport's, because the same row is used both full-width and in the day
// view's ~320px to-do side column, where the hover actions would otherwise
// squeeze the title down to a couple of characters.
export const WorklogTaskRow = React.memo(function WorklogTaskRow({ row }: { row: WorklogRow }) {
  const hasNarrowMeta =
    !!row.status || !!row.priority || !!row.progress || !!row.due || !!row.repeat || row.tags.length > 0 || row.hasLink;
  return (
    <div
      key={row.id}
      className="@container group py-2 px-2.5 rounded-lg hover:bg-neutral-175"
      style={{ paddingLeft: row.pad }}
    >
      <div className="flex items-center gap-[11px]">
        <FoldToggle collapsed={row.collapsed} onToggle={row.onToggleCollapse} />
        <button onClick={row.onDone} title="Mark done" className="w-[17px] h-[17px] shrink-0 border-[1.5px] border-neutral-575 rounded-full bg-white cursor-pointer p-0 hover:border-success-500" />
        {/* Worked toggle — absent for rows with no worked-on state (to-dos). */}
        {row.onWorked && (
          <button
            onClick={row.onWorked}
            title={row.workedTitle}
            className={
              'w-[17px] h-[17px] shrink-0 rounded-full cursor-pointer p-0 flex items-center justify-center ' +
              (row.worked ? 'border border-brand-575 text-brand-575 bg-brand-225 hover:bg-brand-300' : 'border-[1.5px] border-brand-525 bg-white hover:border-brand-575 text-brand-525 hover:text-brand-575')
            }
          >
            <BriefcaseIcon className={`w-[10px] h-[10px]`} />
          </button>
        )}
        {/* Status column — wide rows only; when narrow it moves to the meta row
            below. Absent for rows without a meaningful status (to-dos).
            `min-w-16` rather than `w-16`: the width lines the titles up across a
            list, but a custom status can be named anything, and clipping the one
            word the column exists to show would be worse than the ragged edge a
            long one leaves. */}
        {row.status && (
          <span className="hidden @lg:block min-w-16 shrink-0">
            <StatusPicker
              statusId={row.status.id}
              label={row.status.label}
              name={row.status.name}
              color={row.status.color}
              done={row.status.done}
              choices={row.status.choices}
              onSelect={row.status.onSelect}
            />
          </span>
        )}
        <button
          onClick={row.onView}
          title="View task"
          className="text-row text-neutral-825 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0 hover:underline whitespace-normal leading-[1.35] @lg:whitespace-nowrap @lg:overflow-hidden @lg:text-ellipsis @lg:leading-normal"
        >
          {row.title}
        </button>
        {/* Inline meta — wide rows only. When narrow these reflow to the row below. */}
        <div className="hidden @lg:contents">
          {/* First of the chips: it is the one that says whether the rest of the
              row is worth reading now. */}
          {row.priority && <PriorityChip priority={row.priority} />}
          {row.progress && <ProgressChip progress={row.progress} barWidth={46} />}
          {row.due && <DueChip due={row.due} overdue={row.overdue} days={row.overdueDays} />}
          {row.repeat && <RepeatChip label={row.repeat} />}
          <TagChips tags={row.tags} onTagClick={row.onTagClick} />
        </div>
        {/* Hover actions — wide rows only; they would crowd out the title otherwise. */}
        <div className="hidden @lg:flex items-center gap-[6px] shrink-0 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
          <Button size="xs" onClick={row.onView}>
            View
          </Button>
          <Button size="xs" onClick={row.onEdit}>
            Edit
          </Button>
          <Button size="xs" variant="danger" onClick={row.onDelete}>
            Delete
          </Button>
        </div>
        {row.hasLink && (
          <span className="hidden @lg:inline-flex">
            <LinkChip link={row.link} size={14} />
          </span>
        )}
      </div>

      {/* Narrow-row meta — status + progress + due + tags + link, indented under
          the title (fold slot + done + worked buttons ≈ 72px, 55px without the
          worked one).
          Hidden from `@lg` up, and skipped entirely when there is nothing to show. */}
      {hasNarrowMeta && (
        <div className={'flex @lg:hidden flex-wrap items-center gap-x-[10px] gap-y-[6px] mt-[6px] ' + (row.onWorked ? 'pl-[72px]' : 'pl-[55px]')}>
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
