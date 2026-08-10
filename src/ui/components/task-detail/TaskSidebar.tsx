import React from 'react';
import type { Task } from '../../../model/types';
import { Chip, SidebarSection } from '../../primitives';
import { useData, useUi } from '../../context';
import { clientIdOf, isDone } from '../../utils';
import { isOverdue } from '../../../model/overdue';
import { StatusPicker } from '../StatusPicker';
import { DueEditor } from './DueEditor';
import { ParentEditor } from './ParentEditor';
import { PriorityEditor } from './PriorityEditor';
import { RepeatSummary } from './RepeatSummary';

export interface TaskSidebarProps {
  task: Task;
  parent?: Task;
  routed: boolean;
  /** General to-dos are open or closed only — no status to pick. */
  isTodo: boolean;
  /** Archived completions of a recurring task, for the repeat block's history. */
  occurrences: Task[];
  onOpenTask: (id: string) => void;
}

/** Everything that classifies the task — client, status, dates, repeat, tags and
 *  the parent it hangs off — as the panel's right-hand rail, mirroring the task
 *  form's. The panel's main column is then only what the task *says*: its title,
 *  links, subtasks, description and notes.
 *
 *  The status is the picker, not a label: the rail is where you are already
 *  looking when you decide the task has moved on. */
export function TaskSidebar({ task, parent, routed, isTodo, occurrences, onOpenTask }: TaskSidebarProps) {
  const { statusMeta, statusChoices, setTaskStatus, colorOf, clientName, openTagSearch } = useData();
  const { selectedDate } = useUi();
  const done = isDone(task);
  const status = statusMeta(task.status, done);
  const tags = task.tags ?? [];
  return (
    <>
      <SidebarSection title="Client" divider={false}>
        <span className="flex items-center gap-[6px] text-control text-neutral-750">
          <span className="w-[8px] h-[8px] shrink-0 rounded-full" style={{ background: colorOf(clientIdOf(task)) }} />
          {clientName(clientIdOf(task))}
        </span>
      </SidebarSection>

      {/* Under the client, because it is the other half of "where does this sit":
          the client is the file it lives in, the parent is the task it hangs off.
          Both are always stated, so the rail's first names don't move around. */}
      <ParentEditor task={task} parent={parent} onOpenTask={onOpenTask} />

      {!isTodo && (
        <SidebarSection title="Status">
          <StatusPicker
            statusId={task.status}
            label={status.label}
            name={status.name}
            color={status.color}
            done={done}
            choices={statusChoices}
            onSelect={(statusId) => setTaskStatus(task.id, statusId)}
          />
        </SidebarSection>
      )}

      {/* Under the status, and offered on to-dos too: a to-do has no workflow to
          move through, but it can still be the urgent one. */}
      <PriorityEditor task={task} />

      {/* Two names for one slot: a repeating task's date belongs to the rule, so
          `DueEditor` renders nothing and the repeat block states it instead. */}
      <DueEditor task={task} />
      {!done && <RepeatSummary task={task} occurrences={occurrences} overdue={isOverdue(task, selectedDate)} />}

      {tags.length > 0 && (
        <SidebarSection title="Tags">
          {/* Tags jump to the tag-filtered search, which the routed task page
              doesn't mount — there they stay plain labels. */}
          <div className="flex flex-wrap items-center gap-[6px]">
            {tags.map((tag) =>
              routed ? (
                <Chip key={tag} variant="tag" as="span">
                  {tag}
                </Chip>
              ) : (
                <Chip key={tag} variant="tag" onClick={() => openTagSearch(tag)} title={`Show everything tagged "${tag}"`}>
                  {tag}
                </Chip>
              ),
            )}
          </div>
        </SidebarSection>
      )}
    </>
  );
}
