import React from 'react';
import { ArrowUpRightIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { IconButton, SidebarSection } from '../../primitives';
import { useData } from '../../context';
import { canHaveParent, clientIdOf, parentCandidates } from '../../utils';
import { ParentPicker } from '../ParentPicker';
import { worklogStore } from '../../../data/worklogStore';

/** The task this task hangs off, as a block in the detail panel's rail: a picker
 *  to change it, and a button to go there.
 *
 *  Two controls rather than one, because the parent answers two different
 *  impulses — "this belongs under that" and "take me to that" — and a single
 *  control would have to pick which click means which.
 *
 *  Renders nothing when the task has subtasks of its own (it is already a parent,
 *  and the tree is one level deep) or when the client has nothing to hang it off,
 *  which is the common case for a first task. */
export function ParentEditor({ task, parent, onOpenTask }: { task: Task; parent?: Task; onOpenTask: (id: string) => void }) {
  const { tasks } = useData();
  const clientId = clientIdOf(task);
  const options = React.useMemo(
    () => parentCandidates(tasks, { id: task.id, clientId, parentId: task.parentId }),
    [tasks, task.id, task.parentId, clientId],
  );
  if (!canHaveParent(tasks, task.id) || (options.length === 0 && !parent)) {
    return null;
  }
  return (
    <SidebarSection title="Parent">
      <div className="flex items-center gap-[6px]">
        <ParentPicker
          value={task.parentId ?? ''}
          options={options}
          onSelect={(parentId) => worklogStore.updateTask(task.id, { parentId })}
          className="min-w-0"
        />
        {parent && (
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={`Open ${parent.title}`}
            title="Open the parent task"
            onClick={() => onOpenTask(parent.id)}
          >
            <ArrowUpRightIcon size={14} />
          </IconButton>
        )}
      </div>
    </SidebarSection>
  );
}
