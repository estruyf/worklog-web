import React from 'react';
import type { Task } from '../../../model/types';
import { Chip, LinkButton } from '../../primitives';
import { useData } from '../../context';
import { clientIdOf, isDone } from '../../utils';
import { StatusPicker } from '../StatusPicker';

export interface TaskMetaRowProps {
  task: Task;
  parent?: Task;
  routed: boolean;
  isTodo: boolean;
  onOpenTask: (id: string) => void;
}

/** Status, client, the parent it hangs off, and its tags — the one line that says
 *  where this task sits. The status is the picker, not a label: this row is where
 *  you are already looking when you decide the task has moved on. */
export function TaskMetaRow({ task, parent, routed, isTodo, onOpenTask }: TaskMetaRowProps) {
  const { statusMeta, statusChoices, setTaskStatus, colorOf, clientName, openTagSearch } = useData();
  const done = isDone(task);
  const status = statusMeta(task.status, done);
  return (
    <div className="flex items-center gap-[10px] mb-3">
      {!isTodo && (
        <StatusPicker
          statusId={task.status}
          label={status.label}
          name={status.name}
          color={status.color}
          done={done}
          choices={statusChoices}
          onSelect={(statusId) => setTaskStatus(task.id, statusId)}
        />
      )}
      <span className="flex items-center gap-[6px] text-control text-neutral-750">
        <span className="w-[8px] h-[8px] rounded-full" style={{ background: colorOf(clientIdOf(task)) }} />
        {clientName(clientIdOf(task))}
      </span>
      {parent && (
        <span className="text-control text-neutral-650">
          · in{' '}
          <LinkButton size="md" onClick={() => onOpenTask(parent.id)}>
            {parent.title}
          </LinkButton>
        </span>
      )}
      {/* Tags jump to the tag-filtered search, which the routed task page
          doesn't mount — there they stay plain labels. */}
      {task.tags?.map((tag) =>
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
  );
}
