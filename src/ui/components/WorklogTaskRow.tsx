import React from 'react';
import type { WorklogRow } from '../model';
import { BriefcaseIcon, GlobeIcon, SquareArrowOutUpRight } from 'lucide-react';
import { fmtShort } from '../utils';

/** Subtask completion rollup, shown inline on desktop and below the title on
 * mobile. `barWidth` shrinks the meter to match the narrower mobile row. */
function ProgressChip({ progress, barWidth }: { progress: NonNullable<WorklogRow['progress']>; barWidth: number }) {
  return (
    <span
      title={`${progress.done} of ${progress.total} subtasks done`}
      className="shrink-0 flex items-center gap-[6px] text-[11px] text-neutral-675 tabular-nums"
    >
      <span className="h-[5px] rounded-full bg-neutral-375 overflow-hidden" style={{ width: barWidth }}>
        <span className="block h-full bg-success-500" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
      </span>
      {progress.done}/{progress.total}
    </span>
  );
}

function DueChip({ due, overdue }: { due: string; overdue: boolean }) {
  return (
    <span
      title={overdue ? `Overdue — was due ${due}` : `Due ${due}`}
      className={
        'shrink-0 flex items-center gap-[4px] text-[11px] font-semibold px-[7px] py-[2px] rounded-full ' +
        (overdue ? 'text-danger-675 bg-danger-75 border border-danger-200' : 'text-neutral-675 bg-neutral-250 border border-neutral-400')
      }
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
        <path d="M2.5 6.5h11M5.5 2v2M10.5 2v2" />
      </svg>
      {fmtShort(due)}
    </span>
  );
}

/** Tag chips. Clickable when the row supplies `onTagClick`, which opens the
 * tag-filtered search — otherwise plain labels. */
function TagChips({ tags, onTagClick }: { tags: string[]; onTagClick?: (tag: string) => void }) {
  const base = 'shrink-0 text-[11px] text-neutral-725 bg-neutral-250 border border-neutral-400 rounded-full px-[8px] py-[2px]';
  return (
    <>
      {tags.map((tag) =>
        onTagClick ? (
          <button
            key={tag}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(tag);
            }}
            title={`Show everything tagged "${tag}"`}
            className={base + ' cursor-pointer hover:border-brand-500 hover:bg-brand-175 hover:text-brand-800'}
          >
            {tag}
          </button>
        ) : (
          <span key={tag} className={base}>
            {tag}
          </span>
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
// The row collapses gracefully on narrow screens (< md / 768px, matching the
// sidebar's breakpoint): the status column and hover actions drop out, the
// title is allowed to wrap, and the metadata (status, progress, due, tags,
// link) reflows onto a second line indented under the title.
export const WorklogTaskRow = React.memo(function WorklogTaskRow({ row }: { row: WorklogRow }) {
  const hasMobileMeta = !!row.statusLabel || !!row.progress || !!row.due || row.tags.length > 0 || row.hasLink;
  return (
    <div
      key={row.id}
      className="group py-2 px-2.5 rounded-lg hover:bg-neutral-175"
      style={{ paddingLeft: row.pad }}
    >
      <div className="flex items-center gap-[11px]">
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
        {/* Status column — desktop only; on mobile it moves to the meta row
            below. Absent for rows without a meaningful status (to-dos). */}
        {row.statusLabel && (
          <button onClick={row.onCycle} title="Change status" className="hidden md:block w-16 shrink-0 text-left text-[10.5px] font-bold tracking-[0.05em] bg-transparent border-none cursor-pointer p-0" style={{ color: row.statusColor }}>
            {row.statusLabel}
          </button>
        )}
        <button
          onClick={row.onView}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              row.onOpenTab();
            }
          }}
          onMouseDown={(e) => {
            // Suppress the middle-click autoscroll cursor so onAuxClick can open a tab.
            if (e.button === 1) {
              e.preventDefault();
            }
          }}
          title="View task · middle-click to open in a new tab"
          className="text-[14.5px] text-neutral-825 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0 hover:underline whitespace-normal leading-[1.35] md:whitespace-nowrap md:overflow-hidden md:text-ellipsis md:leading-normal"
        >
          {row.title}
        </button>
        {/* Inline meta — desktop only. On mobile these reflow to the row below. */}
        <div className="hidden md:contents">
          {row.progress && <ProgressChip progress={row.progress} barWidth={46} />}
          {row.due && <DueChip due={row.due} overdue={row.overdue} />}
          <TagChips tags={row.tags} onTagClick={row.onTagClick} />
        </div>
        {/* Hover actions — desktop only. */}
        <div className="hidden md:flex items-center gap-[6px] shrink-0 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
          <button onClick={row.onView} className="px-[8px] py-[5px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 text-[12px] font-medium cursor-pointer hover:bg-neutral-200">
            View
          </button>
          <button onClick={row.onOpenTab} title="Open in a separate tab" className="px-[8px] py-[5px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 leading-[0] cursor-pointer hover:bg-neutral-200">
            <SquareArrowOutUpRight className="w-[14px] h-[14px]" />
          </button>
          <button onClick={row.onEdit} className="px-[8px] py-[5px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 text-[12px] font-medium cursor-pointer hover:bg-neutral-200">
            Edit
          </button>
          <button onClick={row.onDelete} className="px-[8px] py-[5px] border border-danger-225 rounded-[7px] bg-white text-danger-675 text-[12px] font-medium cursor-pointer hover:bg-danger-75">
            Delete
          </button>
        </div>
        {row.hasLink && (
          <span className="hidden md:inline-flex">
            <LinkChip link={row.link} size={14} />
          </span>
        )}
      </div>

      {/* Mobile meta row — status + progress + due + tags + link, indented under
          the title (done + worked buttons ≈ 45px, 28px without the worked one).
          Hidden from md up, and skipped entirely when there is nothing to show. */}
      {hasMobileMeta && (
        <div className={'flex md:hidden flex-wrap items-center gap-x-[10px] gap-y-[6px] mt-[6px] ' + (row.onWorked ? 'pl-[45px]' : 'pl-[28px]')}>
          {row.statusLabel && (
            <button onClick={row.onCycle} title="Change status" className="text-[10.5px] font-bold tracking-[0.05em] bg-transparent border-none cursor-pointer p-0" style={{ color: row.statusColor }}>
              {row.statusLabel}
            </button>
          )}
          {row.progress && <ProgressChip progress={row.progress} barWidth={38} />}
          {row.due && <DueChip due={row.due} overdue={row.overdue} />}
          <TagChips tags={row.tags} onTagClick={row.onTagClick} />
          {row.hasLink && <LinkChip link={row.link} size={13} />}
        </div>
      )}
    </div>
  );
});
