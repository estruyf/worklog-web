import React from 'react';
import type { Task } from '../../../model/types';
import { NORMAL_PRIORITY_ID, PRIORITIES, priorityBucket } from '../../../model/priority';
import { Select, SidebarSection } from '../../primitives';
import { worklogStore } from '../../../data/worklogStore';

/** The task's priority, as a block in the detail panel's rail — next to the
 *  status, since "how much does this matter" is the other half of the question
 *  the status answers.
 *
 *  A `Select` rather than the four-way segmented control the form width would
 *  allow: the rail is 320px, and four segments wrap to two rows at exactly the
 *  size where the rail is doing its job.
 *
 *  The picker always shows a value, because there always is one — a task with no
 *  `- priority:` line reads as Normal, and choosing Normal removes the line. */
export function PriorityEditor({ task }: { task: Task }) {
  return (
    <SidebarSection title="Priority">
      <Select
        size="sm"
        value={priorityBucket(task.priority)}
        onChange={(e) => worklogStore.updateTask(task.id, { priority: e.target.value })}
        aria-label="Priority"
        className="w-full"
      >
        {PRIORITIES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id === NORMAL_PRIORITY_ID ? `${p.label} — no priority set` : p.label}
          </option>
        ))}
      </Select>
    </SidebarSection>
  );
}
