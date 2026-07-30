import React from 'react';
import type { Task } from '../../../model/types';
import { CheckIcon } from 'lucide-react';
import { Card, SectionLabel } from '../../primitives';
import { useData } from '../../context';
import { isDone } from '../../utils';

/** The task's children, each with a tick that closes it in place. Renders nothing
 *  when there are none — a task without subtasks says so by not having a list. */
export function SubtaskList({ subtasks, onOpenTask }: { subtasks: Task[]; onOpenTask: (id: string) => void }) {
  const { statusMeta, markDone } = useData();
  if (subtasks.length === 0) {
    return null;
  }
  const doneCount = subtasks.filter(isDone).length;
  return (
    <div className="mb-7">
      <SectionLabel className="mb-[10px]">
        Subtasks · {doneCount}/{subtasks.length} done
      </SectionLabel>
      <Card padding="list" radius="panel">
        {subtasks.map((c) => {
          const done = isDone(c);
          const status = statusMeta(c.status, done);
          return (
            <div key={c.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-175">
              {done ? (
                <span className="w-[16px] h-[16px] shrink-0 rounded-full bg-success-500 text-white flex items-center justify-center">
                  <CheckIcon size={10} strokeWidth={2.5} />
                </span>
              ) : (
                <button
                  onClick={() => markDone(c)}
                  title="Mark done"
                  aria-label={`Mark ${c.title} done`}
                  className="w-[16px] h-[16px] shrink-0 border-[1.5px] border-neutral-575 rounded-full bg-white cursor-pointer p-0 hover:border-success-500"
                />
              )}
              <span className="w-16 shrink-0 text-status font-bold tracking-status" style={{ color: status.color }}>
                {status.label}
              </span>
              {/* A button rather than a clickable span, for the same reason the
                  completed-task rows are: nothing else here can be tabbed to. */}
              <button
                onClick={() => onOpenTask(c.id)}
                type="button"
                title="Open task"
                className={
                  'text-body flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer hover:underline ' +
                  (done ? 'line-through decoration-neutral-550 text-neutral-700' : 'text-neutral-825')
                }
              >
                {c.title}
              </button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
