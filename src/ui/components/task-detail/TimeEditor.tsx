import React from 'react';
import type { Task } from '../../../model/types';
import { Input, SidebarSection } from '../../primitives';
import { useData, useUi } from '../../context';
import { fmtShort } from '../../utils/date';
import { formatDuration, parseDuration } from '../../../parser/meetingParser';
import { worklogStore } from '../../../data/worklogStore';

/** How long went into the task on the selected day, and in total, as a block in
 *  the detail panel's rail. It is a record and nothing more: the ledger bills a
 *  client per day, and this never adds to or checks against those hours.
 *
 *  The field is for the selected day, like the worked toggle in the header —
 *  time on a day not yet marked worked marks it. */
export function TimeEditor({ task }: { task: Task }) {
  const { today } = useData();
  const { selectedDate } = useUi();
  const stored = task.workedTime?.[selectedDate];
  const days = Object.values(task.workedTime ?? {});
  const total = days.reduce((sum, m) => sum + m, 0);
  const commit = (text: string) => {
    const minutes = parseDuration(text);
    // Something unreadable leaves the stored value alone rather than clearing
    // it; an emptied field is how you clear it.
    if ((minutes || !text.trim()) && minutes !== stored) {
      worklogStore.setWorkedTime(task.id, selectedDate, minutes);
    }
  };
  return (
    <SidebarSection title="Time" hint={selectedDate === today ? 'today' : fmtShort(selectedDate)}>
      <Input
        // Keyed on the stored value so a write, a sync or another day resets
        // what the uncontrolled field shows.
        key={`${selectedDate}:${stored ?? ''}`}
        size="sm"
        className="w-full"
        defaultValue={stored ? formatDuration(stored) : ''}
        placeholder="1h30m"
        aria-label="Time spent on the selected day"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
      />
      {total > 0 && (
        <div className="mt-[6px] text-chip text-neutral-675 tabular-nums">
          {formatDuration(total)} in total · {days.length} {days.length === 1 ? 'day' : 'days'}
        </div>
      )}
    </SidebarSection>
  );
}
