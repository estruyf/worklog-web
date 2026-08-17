import React, { useMemo, useState } from 'react';
import type { Task } from '../../../model/types';
import { CheckIcon, PlusIcon } from 'lucide-react';
import { isGeneralTodoClientId } from '../../../model/todos';
import { Button, Card, EmptyState, LinkButton, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';
import { canHaveSubtasks, clientIdOf, deriveSubtaskList, isDone, workedLabels, workedOnDate } from '../../utils';
import { StatusPicker } from '../StatusPicker';
import { WorkedToggle } from '../WorkedToggle';

/** The task's children, each with a tick that closes it in place, under a header
 *  that carries the count and the way to add another.
 *
 *  Each row also carries the worked-on toggle the day view's rows have: a subtask
 *  is work logged against a day like any other task, and needing to open each one
 *  to say so was the one thing this list couldn't do that the day view could. It
 *  writes to the selected day, the same as every other worked-on control.
 *
 *  The add button sits here
 *  rather than in the panel's action row — the way GitHub hangs "Add sub-issue"
 *  off the sub-issues section and not off the issue's own actions — so the list
 *  it adds to is on screen when you press it. That is also why the section still
 *  renders with no children: it is the entry point, so it cannot be conditional
 *  on there already being something to enter. A done task keeps its list as a
 *  record but loses the button, for the same reason its header loses "Mark done".
 *
 *  The done subtasks are folded away behind the header's toggle — see
 *  `deriveSubtaskList` for why, and for the one case that overrides it. The
 *  choice is per open panel, not persisted: it is a way to check the record,
 *  not a display preference. */
export function SubtaskList({
  task,
  subtasks,
  onOpenTask,
}: {
  task: Task;
  subtasks: Task[];
  onOpenTask: (id: string) => void;
}) {
  const { statusMeta, statusChoices, setTaskStatus, markDone, openSubtaskForm, today, toggleWorked } = useData();
  const { selectedDate } = useUi();
  const [showDone, setShowDone] = useState(false);
  const { visible, doneCount, showingDone, canToggle } = useMemo(
    () => deriveSubtaskList(subtasks, showDone),
    [subtasks, showDone],
  );
  const parentDone = isDone(task);
  // A subtask gets no section of its own: the tree is one level deep, so there is
  // nothing it could ever list and nothing it could add. The mirror of
  // `ParentEditor` dropping the parent field on a task that already has children.
  if (!canHaveSubtasks(task)) {
    return null;
  }
  // Nothing to list and nothing to add: an empty section on a closed task is a
  // heading over a heading.
  if (parentDone && subtasks.length === 0) {
    return null;
  }
  return (
    // The section owns the gap above it now that it follows the description
    // editor, which ends flush with its border — the same way Notes does below.
    <div className="mt-9 mb-7">
      <div className="flex items-center justify-between gap-3 mb-[10px]">
        <SectionLabel>Subtasks{subtasks.length > 0 && ` · ${doneCount}/${subtasks.length} done`}</SectionLabel>
        <div className="flex items-center gap-3 shrink-0">
          {canToggle && (
            <LinkButton
              tone="neutral"
              onClick={() => setShowDone(!showingDone)}
              title={showingDone ? 'Hide the subtasks that are done' : 'Show the subtasks that are done'}
            >
              {showingDone ? 'Hide done' : `Show ${doneCount} done`}
            </LinkButton>
          )}
          {!parentDone && (
            <Button size="xs" onClick={() => openSubtaskForm(task)} title="Create a task under this one">
              <PlusIcon size={13} strokeWidth={2.2} />
              Add subtask
            </Button>
          )}
        </div>
      </div>
      {subtasks.length === 0 ? (
        <EmptyState size="sm">No subtasks yet.</EmptyState>
      ) : (
        <Card padding="list" radius="panel">
          {visible.map((c) => {
            const done = isDone(c);
            const status = statusMeta(c.status, done);
            // Same rule the day view's rows follow: general to-dos are open or
            // closed only, so they carry no worked-on state to toggle. A subtask
            // has its parent's client, so this is all-or-nothing across the list
            // and the titles stay lined up either way.
            const tracksWork = !isGeneralTodoClientId(clientIdOf(c));
            const worked = tracksWork && workedOnDate(c, selectedDate);
            const workedText = workedLabels(worked, selectedDate, today);
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
                    className="w-[16px] h-[16px] shrink-0 border-[1.5px] border-neutral-575 rounded-full bg-white cursor-pointer p-0 text-neutral-500 hover:border-success-500 hover:text-success-500 flex items-center justify-center"
                  >
                    <CheckIcon size={10} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                )}
                {tracksWork && (
                  <WorkedToggle
                    size="sm"
                    worked={worked}
                    onToggle={() => toggleWorked(c)}
                    title={workedText.title}
                    label={workedText.action}
                    ariaLabel={`${workedText.action} — ${c.title}`}
                  />
                )}
                <span className="min-w-16 shrink-0">
                  <StatusPicker
                    statusId={c.status}
                    label={status.label}
                    name={status.name}
                    color={status.color}
                    done={done}
                    choices={statusChoices}
                    onSelect={(statusId) => setTaskStatus(c.id, statusId)}
                  />
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
      )}
    </div>
  );
}
