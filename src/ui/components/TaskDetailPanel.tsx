import React, { useEffect, useMemo, useState } from 'react';
import { InfoIcon, MessageSquareIcon } from 'lucide-react';
import { clientIdOf } from '../utils';
import { isGeneralTodoClientId } from '../../model/todos';
import { Button, IconButton, LinkButton, Modal } from '../primitives';
import { CopyButton } from './CopyButton';
import { LinkList } from './LinkList';
import { DescriptionEditor } from './DescriptionEditor';
import { AttachmentsSection, NotesSection, PromptsSection, SubtaskList, TaskContentActions, TaskDetailHeader, TaskSidebar, TitleEditor } from './task-detail';
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
 * is laid out. On a phone the rail and the notes leave the page and sit behind two
 * floating buttons as bottom sheets, so the content is what you land on.
 *
 * Fills the dashboard's main column rather than covering it, for the reason the
 * task form does (see TaskFormPage): the nav stays put and this reads as a view.
 * Mounted only on a task route, so the id is always set — an id that resolves to
 * nothing is a link to a task that has since been deleted, which is worth saying
 * rather than rendering blank. */
export function TaskDetailPanel() {
  const { saveDescription, saveDescriptionText, editDescription, cancelDescription } = useData();
  const { descDraft, setDescDraft, descMode, setDescMode, setPromptComposing } = useUi();
  const { task, parent, subtasks, occurrences, descDirty } = useDetailData();
  // Which phone sheet is up. A link inside one (the parent, an occurrence, a
  // mentioned task) navigates to another task under the sheet — close it, or it
  // stays up showing the new task's data as if nothing happened.
  const [sheet, setSheet] = useState<'details' | 'notes' | null>(null);
  const taskId = task?.id;
  useEffect(() => {
    setSheet(null);
    // A prompt composer opened on the task you left is not open on the one you
    // arrived at — same reasoning as the sheet above.
    setPromptComposing(false);
  }, [taskId, setPromptComposing]);
  if (!task) {
    return <MissingTask />;
  }
  // General to-dos are open or closed only — no worked-on marking.
  const isTodo = isGeneralTodoClientId(clientIdOf(task));
  // Measured on the draft rather than the task: it is what the editor shows, and
  // in `read` the two are the same text. Nothing written and nothing being
  // written means no section at all — "+ Description" below is the way in.
  const hasDescription = descMode !== 'read' || descDraft.trim() !== '';
  return (
    // The header is the band; the rest scrolls under it. The gutter sits outside
    // the centering box, the way every view under src/ui/views does it — inside,
    // it would eat into the 920px column and the content would shift as you move
    // between a day and a task on it.
    <div className="flex flex-1 flex-col min-h-0 bg-white">
      <TaskDetailHeader task={task} parent={parent} isTodo={isTodo} />

      {/* The extra bottom padding below lg keeps the last of the content clear of
          the floating buttons. */}
      <div className="flex-1 overflow-auto px-6 pt-6 pb-24 lg:pb-8">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto w-full">
          {/* Two columns at lg. Below that the rail and the notes are not in the
              page at all — they open as bottom sheets from the floating buttons,
              so a phone lands on the content instead of scrolling the whole
              metadata rail to reach it. */}
          <div className="lg:flex lg:gap-8">
            <div className="lg:flex-1 lg:min-w-0">
              {/* Keyed by the task so a rename left open doesn't follow you to
                  the next one, the same as the prompt composer below. */}
              <TitleEditor key={task.id} task={task} />

              <LinkList links={task.links} className="mb-6" />

              {/* Nothing to show and nothing being written: the way in is the
                  "+ Description" offer below, not an empty editor. */}
              {hasDescription && (
                <DescriptionEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  mode={descMode}
                  onModeChange={setDescMode}
                  taskId={task.id}
                  // ⌘↵ is Save, the same keystroke that saves a note or a task
                  // form — and only while there is something to save, which is
                  // the condition the Save button below is disabled on.
                  onSubmit={descDirty ? saveDescription : undefined}
                  // Reading, a tick is the whole edit and saves itself — there is
                  // no Save to press, and a checkbox that needs one is a checkbox
                  // that lies. Mid-edit it is an edit like any other, and Save
                  // still decides.
                  onTaskToggle={descMode === 'read' ? saveDescriptionText : setDescDraft}
                  // Edit opens the editor; Cancel and Save are the two ways out
                  // of it, and both are on screen the whole time it is open —
                  // including in Preview, which is a look at the draft rather
                  // than a way of leaving it.
                  action={
                    descMode === 'read' ? (
                      // Measured against what is on screen, which is the draft —
                      // in `read` that is the stored description either way.
                      descDraft.trim() !== '' && (
                        <>
                          <CopyButton value={descDraft} label="Copy description" />
                          <Button variant="neutral" size="xs" onClick={editDescription}>
                            Edit
                          </Button>
                        </>
                      )
                    ) : (
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
              )}

              <TaskContentActions task={task} hasDescription={hasDescription} hasSubtasks={subtasks.length > 0} />

              <AttachmentsSection task={task} />

              <SubtaskList task={task} subtasks={subtasks} onOpenTask={navigateToTask} />

              {/* Keyed by the task so an expanded prompt, an open edit or a
                  half-written draft doesn't follow you to the next one. */}
              <PromptsSection key={task.id} task={task} />

              <div className="hidden lg:block">
                <NotesSection task={task} />
              </div>
            </div>

            <aside className="hidden lg:block w-[320px] shrink-0 border-l border-neutral-375 pl-8">
              <TaskSidebar task={task} parent={parent} isTodo={isTodo} occurrences={occurrences} onOpenTask={navigateToTask} />
            </aside>
          </div>
        </div>
      </div>

      {/* The phone's way into what the page set aside, bottom-right where the
          thumb is: notes — the action you repeat — as the labelled pill, the
          rail behind the ⓘ. Under the sheets' backdrop (z-40 vs z-50), so an
          open sheet covers them. */}
      <div className="lg:hidden fixed right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5">
        <Button variant="secondary" size="md" onClick={() => setSheet('notes')} className="h-10 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
          <MessageSquareIcon size={16} />
          Notes{task.notes && task.notes.length > 0 ? ` · ${task.notes.length}` : ''}
        </Button>
        <IconButton
          variant="outline"
          onClick={() => setSheet('details')}
          aria-label="Task details"
          title="Task details"
          className="w-10 h-10 shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
        >
          <InfoIcon size={18} />
        </IconButton>
      </div>

      {sheet === 'details' && (
        <Modal placement="sheet" onClose={() => setSheet(null)} title="Details" titleSize="sm" showClose>
          <div className="mt-4">
            <TaskSidebar task={task} parent={parent} isTodo={isTodo} occurrences={occurrences} onOpenTask={navigateToTask} />
          </div>
        </Modal>
      )}
      {sheet === 'notes' && (
        <Modal
          placement="sheet"
          onClose={() => setSheet(null)}
          title={`Notes${task.notes && task.notes.length > 0 ? ` · ${task.notes.length}` : ''}`}
          titleSize="sm"
          showClose
        >
          <div className="mt-4">
            <NotesSection task={task} bare />
          </div>
        </Modal>
      )}
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
