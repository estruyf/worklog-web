import React, { useMemo } from 'react';
import { clientIdOf, isDone, linksOf } from '../utils';
import { ExternalLinkIcon } from 'lucide-react';
import { isGeneralTodoClientId } from '../../model/todos';
import { Button } from '../primitives';
import { DescriptionEditor } from './DescriptionEditor';
import { NotesSection, SubtaskList, TaskDetailHeader, TaskSidebar } from './task-detail';
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

/** Full-screen task detail overlay: header actions, then the task's own content —
 * title, links, subtasks, description, notes — with everything that classifies it
 * in a rail on the right, the same way the task form is laid out. Renders nothing
 * when no task is open. In `routed` mode (the /app/task/<id> page) the in-panel
 * Back / Open buttons are hidden — the breadcrumb handles that — and parent /
 * subtask navigation pushes the matching task route. */
export function TaskDetailPanel({ routed = false }: { routed?: boolean } = {}) {
  const { saveDescription, saveDescriptionText } = useData();
  const { descDraft, setDescDraft, descMode, setDescMode, setDetailId } = useUi();
  const { task, parent, subtasks, occurrences, descDirty } = useDetailData();
  if (!task) {
    return null;
  }
  const onOpenTask = (id: string) => (routed ? navigateToTask(id) : setDetailId(id));
  // General to-dos are open or closed only — no worked-on marking.
  const isTodo = isGeneralTodoClientId(clientIdOf(task));
  return (
    <div className={'fixed inset-0 z-40 bg-white overflow-auto' + (routed ? '' : ' top-13 md:top-0 md:left-57')}> {/* clears the mobile top bar (h-13) and the 228px (w-57) desktop sidebar rail */}
      <div className="max-w-[1240px] mx-auto px-5 py-8 md:px-8">
        <TaskDetailHeader
          task={task}
          parent={parent}
          routed={routed}
          isTodo={isTodo}
          onBack={() => setDetailId(null)}
          onOpenTask={onOpenTask}
        />

        {/* Below lg this is one ordered column rather than two, by the same trick
            the task form uses: `contents` dissolves the column wrappers so their
            blocks become siblings, and the rail can sit under the title and its
            links — what the task is, then where it stands — with the long content
            below. At lg the wrappers become real columns and the order utilities
            go inert, since the blocks are no longer flex items. */}
        <div className="flex flex-col lg:flex-row lg:gap-8">
          <div className="contents lg:block lg:flex-1 lg:min-w-0">
            <div className="order-1">
              <h1 className={'text-[26px] font-bold m-0 mb-5 tracking-[-0.01em] ' + (isDone(task) ? 'line-through decoration-neutral-550 text-neutral-700' : '')}>
                {task.title}
              </h1>

              {linksOf(task).length > 0 && (
                <div className="flex flex-col gap-1 mb-6">
                  {task.links.map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-[7px] text-control-lg text-info hover:underline w-fit break-all">
                      <ExternalLinkIcon size={14} className="shrink-0" />
                      {l.label || l.url}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="order-3">
              <SubtaskList task={task} subtasks={subtasks} onOpenTask={onOpenTask} />

              <DescriptionEditor
                value={descDraft}
                onChange={setDescDraft}
                mode={descMode}
                onModeChange={setDescMode}
                // Ticking a box on a saved task saves: there is no Save to press in
                // preview, and a checkbox that needs one is a checkbox that lies.
                onTaskToggle={saveDescriptionText}
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

          <aside className="contents lg:block lg:w-[320px] lg:shrink-0 lg:border-l lg:border-neutral-375 lg:pl-8">
            <div className="order-2 mb-4 lg:mb-0">
              <TaskSidebar
                task={task}
                parent={parent}
                routed={routed}
                isTodo={isTodo}
                occurrences={occurrences}
                onOpenTask={onOpenTask}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
