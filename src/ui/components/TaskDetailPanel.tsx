import React, { useMemo } from 'react';
import { clientIdOf, isDone, linksOf } from '../utils';
import { ExternalLinkIcon } from 'lucide-react';
import { isGeneralTodoClientId } from '../../model/todos';
import { isOverdue } from '../../model/overdue';
import { Button } from '../primitives';
import { DescriptionEditor } from './DescriptionEditor';
import { DueEditor, NotesSection, RepeatSummary, SubtaskList, TaskDetailHeader, TaskMetaRow } from './task-detail';
import { useData, useUi } from '../context';
import { navigateToTask } from '../router';

/** Resolves the task pointed at by detailId plus its parent, subtasks and dirty flag. */
function useDetailData() {
  const { tasks } = useData();
  const { detailId, descDraft } = useUi();
  const task = useMemo(() => (detailId ? tasks.find((t) => t.id === detailId) : undefined), [detailId, tasks]);
  const subtasks = useMemo(() => (task ? tasks.filter((t) => t.parentId === task.id) : []), [task, tasks]);
  const parent = useMemo(() => (task?.parentId ? tasks.find((t) => t.id === task.parentId) : undefined), [task, tasks]);
  // Archived snapshots of a recurring task, most recently completed first.
  const occurrences = useMemo(
    () =>
      task?.repeat
        ? tasks
          .filter((t) => t.repeatOf === task.id && t.completed)
          .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? ''))
        : [],
    [task, tasks],
  );
  return { task, parent, subtasks, occurrences, descDirty: !!task && descDraft !== (task.description ?? '') };
}

/** Full-screen task detail overlay: header actions, metadata, subtasks and a
 * markdown description editor with preview. Renders nothing when no task is open.
 * In `routed` mode (the /app/task/<id> page) the in-panel Back / Open buttons are
 * hidden — the breadcrumb handles that — and parent/subtask navigation pushes the
 * matching task route. */
export function TaskDetailPanel({ routed = false }: { routed?: boolean } = {}) {
  const { saveDescription } = useData();
  const { selectedDate, descDraft, setDescDraft, descMode, setDescMode, setDetailId } = useUi();
  const { task, parent, subtasks, occurrences, descDirty } = useDetailData();
  if (!task) {
    return null;
  }
  const onOpenTask = (id: string) => (routed ? navigateToTask(id) : setDetailId(id));
  // General to-dos are open or closed only — no worked-on marking.
  const isTodo = isGeneralTodoClientId(clientIdOf(task));
  return (
    <div className={'fixed inset-0 z-40 bg-white overflow-auto' + (routed ? '' : ' top-13 md:top-0 md:left-57')}> {/* clears the mobile top bar (h-13) and the 228px (w-57) desktop sidebar rail */}
      <div className="max-w-[860px] mx-auto px-8 py-8">
        <TaskDetailHeader
          task={task}
          parent={parent}
          routed={routed}
          isTodo={isTodo}
          onBack={() => setDetailId(null)}
          onOpenTask={onOpenTask}
        />

        <TaskMetaRow task={task} parent={parent} routed={routed} isTodo={isTodo} onOpenTask={onOpenTask} />

        <DueEditor task={task} />
        {!isDone(task) && <RepeatSummary task={task} occurrences={occurrences} overdue={isOverdue(task, selectedDate)} />}

        <h1 className={'text-[26px] font-bold m-0 mb-5 tracking-[-0.01em] ' + (isDone(task) ? 'line-through decoration-neutral-550 text-neutral-700' : '')}>
          {task.title}
        </h1>

        {linksOf(task).length > 0 && (
          <div className="flex flex-col gap-1 mb-6">
            {task.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-[7px] text-control-lg text-info hover:underline w-fit">
                <ExternalLinkIcon size={14} />
                {l.label || l.url}
              </a>
            ))}
          </div>
        )}

        <SubtaskList subtasks={subtasks} onOpenTask={onOpenTask} />

        <DescriptionEditor
          value={descDraft}
          onChange={setDescDraft}
          mode={descMode}
          onModeChange={setDescMode}
          action={
            descDirty && (
              <Button variant="primary" size="xs" onClick={saveDescription} className="font-semibold">
                Save
              </Button>
            )
          }
        />

        <NotesSection task={task} />
      </div>
    </div>
  );
}
