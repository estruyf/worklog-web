import React from 'react';
import type { Task } from '../../../model/types';
import { SidebarSection } from '../../primitives';
import { PriorityPicker } from '../PriorityPicker';
import { worklogStore } from '../../../data/worklogStore';

/** The task's priority, as a block in the detail panel's rail — next to the
 *  status, since "how much does this matter" is the other half of the question
 *  the status answers, and it is changed the same way: click the value, pick
 *  another. Writing is immediate, as everywhere else in this rail.
 *
 *  The picker always shows a value, because there always is one — a task with no
 *  `- priority:` line reads as Normal, and choosing Normal removes the line. */
export function PriorityEditor({ task }: { task: Task }) {
  return (
    <SidebarSection title="Priority">
      <PriorityPicker value={task.priority} onSelect={(priority) => worklogStore.updateTask(task.id, { priority })} />
    </SidebarSection>
  );
}
