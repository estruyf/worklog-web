import React from 'react';
import type { Task } from '../../../model/types';
import { RefreshCwIcon } from 'lucide-react';
import { describeRecurrence } from '../../../model/recurrence';

/** How many past occurrences the history strip shows before collapsing. */
const HISTORY_LIMIT = 8;

/** Recurrence summary for a repeating task: the rule in words, when the next
 *  occurrence lands, and the completions already logged. */
export function RepeatSummary({
  task,
  occurrences,
  overdue,
}: {
  task: Task;
  occurrences: Task[];
  overdue: boolean;
}) {
  if (!task.repeat) {
    return null;
  }
  const shown = occurrences.slice(0, HISTORY_LIMIT);
  const hidden = occurrences.length - shown.length;
  return (
    <div className="mb-4 px-[14px] py-[11px] border border-brand-375 bg-brand-100 rounded-panel text-control text-neutral-750">
      <div className="flex items-center gap-[7px] font-semibold text-brand-800">
        <RefreshCwIcon className="w-[13px] h-[13px]" />
        {describeRecurrence(task.repeat)}
      </div>
      <div className="mt-[5px] text-chip text-neutral-700">
        {task.due ? <>Next on {task.due}</> : <>No next date set</>}
        {task.lastDone && <> · last done {task.lastDone}</>}
        {overdue && <span className="text-danger-675 font-semibold"> · overdue</span>}
      </div>
      {shown.length > 0 && (
        <div className="mt-[9px] flex flex-wrap items-center gap-[6px]">
          {shown.map((o) => (
            <span
              key={o.id}
              title={`Completed ${o.completed}`}
              className="text-eyebrow text-neutral-725 bg-white border border-neutral-400 rounded-full px-[8px] py-[2px] tabular-nums"
            >
              {o.completed}
            </span>
          ))}
          {hidden > 0 && <span className="text-count text-neutral-650">+{hidden} more in the archive</span>}
        </div>
      )}
    </div>
  );
}
