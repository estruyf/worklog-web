import React, { useMemo } from 'react';
import { clientIdOf, isDone } from '../utils';
import { isGeneralTodoClientId } from '../../model/todos';
import { Button, LinkButton } from '../primitives';
import { LinkList } from './LinkList';
import { DescriptionEditor } from './DescriptionEditor';
import { NotesSection, SubtaskList, TaskDetailHeader, TaskSidebar } from './task-detail';
import { useData, useUi } from '../context';
import { navigateToDashboard, navigateToTask } from '../router';

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

/** The task at /app/task/<id>: breadcrumb and the two actions you came to press,
 * then the task's own content — title, links, description, subtasks, notes — with
 * everything that classifies it in a rail on the right, the same way the task form
 * is laid out.
 *
 * Fills the dashboard's main column rather than covering it, for the reason the
 * task form does (see TaskFormPage): the nav stays put and this reads as a view.
 * Mounted only on a task route, so the id is always set — an id that resolves to
 * nothing is a link to a task that has since been deleted, which is worth saying
 * rather than rendering blank. */
export function TaskDetailPanel() {
  const { saveDescription, saveDescriptionText, cancelDescription } = useData();
  const { descDraft, setDescDraft, descMode, setDescMode } = useUi();
  const { task, parent, subtasks, occurrences, descDirty } = useDetailData();
  if (!task) {
    return <MissingTask />;
  }
  // General to-dos are open or closed only — no worked-on marking.
  const isTodo = isGeneralTodoClientId(clientIdOf(task));
  return (
    // The header is the band; the rest scrolls under it. The gutter sits outside
    // the centering box, the way every view under src/ui/views does it — inside,
    // it would eat into the 920px column and the content would shift as you move
    // between a day and a task on it.
    <div className="flex flex-1 flex-col min-h-0 bg-white">
      <TaskDetailHeader task={task} parent={parent} isTodo={isTodo} />

      <div className="flex-1 overflow-auto px-6 pt-6 pb-8">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto w-full">
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

                <LinkList links={task.links} className="mb-6" />
              </div>

              <div className="order-3">
                <DescriptionEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  mode={descMode}
                  onModeChange={setDescMode}
                  taskId={task.id}
                  // Ticking a box on a saved task saves: there is no Save to press in
                  // preview, and a checkbox that needs one is a checkbox that lies.
                  onTaskToggle={saveDescriptionText}
                  // The same pair the day note has, and for the same reason: an
                  // editor you can only leave by saving is one that has no way
                  // out. They stay up in preview while the draft is dirty —
                  // switching tabs is not abandoning the edit, and hiding Save
                  // there would strand it.
                  action={
                    (descMode === 'edit' || descDirty) && (
                      <>
                        <Button variant="neutral" size="xs" onClick={cancelDescription}>
                          Cancel
                        </Button>
                        <Button variant="primary" size="xs" onClick={saveDescription} disabled={!descDirty} className="font-semibold">
                          Save
                        </Button>
                      </>
                    )
                  }
                />

                <SubtaskList task={task} subtasks={subtasks} onOpenTask={navigateToTask} />

                <NotesSection task={task} />
              </div>
            </div>

            <aside className="contents lg:block lg:w-[320px] lg:shrink-0 lg:border-l lg:border-neutral-375 lg:pl-8">
              <div className="order-2 mb-4 lg:mb-0">
                <TaskSidebar task={task} parent={parent} isTodo={isTodo} occurrences={occurrences} onOpenTask={navigateToTask} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What a link to a task that no longer exists lands on. Reachable by URL alone —
 *  the app steps off the route itself when you delete the task you are looking at
 *  — so it says what happened rather than redirecting somewhere unexplained. */
function MissingTask() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-white text-body text-neutral-675">
      This task no longer exists.
      <LinkButton onClick={navigateToDashboard}>‹ Back to Worklog</LinkButton>
    </div>
  );
}
