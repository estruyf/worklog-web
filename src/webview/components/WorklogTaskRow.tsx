import React from 'react';
import { WorklogRow } from '../model';
import { BriefcaseIcon, GlobeIcon, SquareArrowOutUpRight } from 'lucide-react';
import { fmtShort } from '../utils';

// Memoized so a row skips re-rendering while its stable `row` object is
// unchanged — important because the task lists re-render on every keystroke in
// the surrounding views (log form, search box).
export const WorklogTaskRow = React.memo(function WorklogTaskRow({ row }: { row: WorklogRow }) {
  return (
    <div
      key={row.id}
      className="group flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-[#F7F8FA]"
      style={{ paddingLeft: row.pad }}
      data-vscode-context={JSON.stringify({ webviewSection: 'worklogTask', taskId: row.id, preventDefaultContextMenuItems: true })}
    >
      <button onClick={row.onDone} title="Mark done" className="w-[17px] h-[17px] shrink-0 border-[1.5px] border-[#C9CFD6] rounded-full bg-white cursor-pointer p-0 hover:border-[#16A34A]" />
      <button
        onClick={row.onWorked}
        title={row.workedTitle}
        className={
          'w-[17px] h-[17px] shrink-0 rounded-full cursor-pointer p-0 flex items-center justify-center ' +
          (row.worked ? 'border border-[#A96800] text-[#A96800] bg-[#FBEFC0] hover:bg-[#F9E7A3]' : 'border-[1.5px] border-[#D7B770] bg-white hover:border-[#A96800] text-[#D7B770] hover:text-[#A96800]')
        }
      >
        <BriefcaseIcon className={`w-[10px] h-[10px]`} />
      </button>
      <button onClick={row.onCycle} title="Change status" className="w-16 shrink-0 text-left text-[10.5px] font-bold tracking-[0.05em] bg-transparent border-none cursor-pointer p-0" style={{ color: row.statusColor }}>
        {row.statusLabel}
      </button>
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
        className="text-[14.5px] text-[#1F2328] flex-1 text-left bg-transparent border-none cursor-pointer p-0 hover:underline"
      >
        {row.title}
      </button>
      {row.progress && (
        <span
          title={`${row.progress.done} of ${row.progress.total} subtasks done`}
          className="shrink-0 flex items-center gap-[6px] text-[11px] text-[#6E7781] tabular-nums"
        >
          <span className="w-[46px] h-[5px] rounded-full bg-[#ECEEF1] overflow-hidden">
            <span className="block h-full bg-[#16A34A]" style={{ width: `${row.progress.total ? (row.progress.done / row.progress.total) * 100 : 0}%` }} />
          </span>
          {row.progress.done}/{row.progress.total}
        </span>
      )}
      {row.due && (
        <span
          title={row.overdue ? `Overdue — was due ${row.due}` : `Due ${row.due}`}
          className={
            'shrink-0 flex items-center gap-[4px] text-[11px] font-semibold px-[7px] py-[2px] rounded-full ' +
            (row.overdue ? 'text-[#DC2626] bg-[#FEF2F2] border border-[#F5C9C9]' : 'text-[#6E7781] bg-[#F1F2F4] border border-[#E5E7EB]')
          }
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
            <path d="M2.5 6.5h11M5.5 2v2M10.5 2v2" />
          </svg>
          {fmtShort(row.due)}
        </span>
      )}
      {row.tags.map((tag) => (
        <span key={tag} className="shrink-0 text-[11px] text-[#4B5563] bg-[#F1F2F4] border border-[#E5E7EB] rounded-full px-[8px] py-[2px]">
          {tag}
        </span>
      ))}
      <div className="flex items-center gap-[6px] shrink-0 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto">
        <button onClick={row.onView} className="px-[8px] py-[5px] border border-[#E5E7EB] rounded-[7px] bg-white text-[#3C4149] text-[12px] font-medium cursor-pointer hover:bg-[#F6F7F9]">
          View
        </button>
        <button onClick={row.onOpenTab} title="Open in a separate tab" className="px-[8px] py-[5px] border border-[#E5E7EB] rounded-[7px] bg-white text-[#3C4149] leading-[0] cursor-pointer hover:bg-[#F6F7F9]">
          <SquareArrowOutUpRight className="w-[14px] h-[14px]" />
        </button>
        <button onClick={row.onEdit} className="px-[8px] py-[5px] border border-[#E5E7EB] rounded-[7px] bg-white text-[#3C4149] text-[12px] font-medium cursor-pointer hover:bg-[#F6F7F9]">
          Edit
        </button>
        <button onClick={row.onDelete} className="px-[8px] py-[5px] border border-[#F0C9C9] rounded-[7px] bg-white text-[#DC2626] text-[12px] font-medium cursor-pointer hover:bg-[#FEF2F2]">
          Delete
        </button>
      </div>
      {row.hasLink && (
        <a href={row.link} target="_blank" rel="noreferrer noopener" className="text-[#9AA0A6] shrink-0 leading-[0] hover:text-[#2D6CDF]" title={row.link}>
          <GlobeIcon className="w-[14px] h-[14px]" />
        </a>
      )}
    </div>
  );
});
