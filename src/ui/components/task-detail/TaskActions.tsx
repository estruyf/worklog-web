import React from 'react';
import type { Task } from '../../../model/types';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { SidebarSection } from '../../primitives';
import { useData } from '../../context';
import { isDone } from '../../utils';

/** One row of the actions list: icon, then label, full width. Not a `Button` —
 *  these read as a menu rather than a toolbar cluster, so they carry no border
 *  and no fill until hovered, and the destructive one says so in its own colour
 *  instead of a solid red block. */
function Action({
  icon,
  label,
  onClick,
  title,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  title?: string;
  tone?: 'neutral' | 'danger';
}) {
  const tones = {
    neutral: 'text-neutral-750 hover:bg-neutral-200',
    danger: 'text-danger-675 hover:bg-danger-75',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        'w-full flex items-center gap-[10px] px-2 py-[7px] rounded-control text-control text-left bg-transparent border-none cursor-pointer ' +
        tones[tone]
      }
    >
      <span className="shrink-0 flex" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}

/** The rest of what can be done to the open task, as the last block of the rail —
 *  the shape GitHub gives an issue's actions: a plain vertical list, destructive
 *  last and in red. Marking worked and marking done stay buttons in the panel's
 *  header, because those are the two you came to press; this list is what you go
 *  looking for. */
export function TaskActions({ task }: { task: Task }) {
  const { openEdit, deleteTask } = useData();
  const done = isDone(task);
  return (
    <SidebarSection title="Actions">
      {/* Pulled out to the rail's edge: the rows' own padding is what aligns
          their labels with the blocks above, so the hover fill can be wider than
          the text without the list looking indented. */}
      <div className="flex flex-col -mx-2">
        <Action icon={<PencilIcon size={15} />} label="Edit details" onClick={() => openEdit(task)} />
        <Action
          icon={<Trash2Icon size={15} />}
          label={done ? 'Delete forever' : 'Delete'}
          tone="danger"
          onClick={() => deleteTask(task.id, { permanent: done })}
        />
      </div>
    </SidebarSection>
  );
}
