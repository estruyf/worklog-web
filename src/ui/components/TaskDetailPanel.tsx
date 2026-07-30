import React, { useMemo } from 'react';
import { clientIdOf, isDone, linksOf, renderMarkdown, makeImageResolver, workedOnDate } from '../utils';
import { BriefcaseIcon, CheckIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react';
import type { Task } from '../../model/types';
import { describeRecurrence } from '../../model/recurrence';
import { isGeneralTodoClientId } from '../../model/todos';
import { daysOverdue, formatDaysLate, isOverdue } from '../../model/overdue';
import { Button, Card, Chip, DateInput, EmptyState, LinkButton, SectionLabel, TextArea } from '../primitives';
import { DescriptionEditor } from './DescriptionEditor';
import { useData, useUi } from '../context';
import { navigateToDashboard, navigateToTask } from '../router';
import { worklogStore } from '../../data/worklogStore';

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

/** How many past occurrences the history strip shows before collapsing. */
const HISTORY_LIMIT = 8;

/** Recurrence summary for a repeating task: the rule in words, when the next
 *  occurrence lands, and the completions already logged. */
function RepeatSummary({
  task,
  occurrences,
  overdue,
}: {
  task: Task;
  occurrences: Task[];
  overdue: boolean;
}) {
  if (!task.repeat) {
    return null;
  }
  const shown = occurrences.slice(0, HISTORY_LIMIT);
  const hidden = occurrences.length - shown.length;
  return (
    <div className="mb-4 px-[14px] py-[11px] border border-brand-375 bg-brand-100 rounded-panel text-control text-neutral-750">
      <div className="flex items-center gap-[7px] font-semibold text-brand-800">
        <RefreshCwIcon className="w-[13px] h-[13px]" />
        {describeRecurrence(task.repeat)}
      </div>
      <div className="mt-[5px] text-chip text-neutral-700">
        {task.due ? <>Next on {task.due}</> : <>No next date set</>}
        {task.lastDone && <> · last done {task.lastDone}</>}
        {overdue && <span className="text-danger-675 font-semibold"> · overdue</span>}
      </div>
      {shown.length > 0 && (
        <div className="mt-[9px] flex flex-wrap items-center gap-[6px]">
          {shown.map((o) => (
            <span
              key={o.id}
              title={`Completed ${o.completed}`}
              className="text-eyebrow text-neutral-725 bg-white border border-neutral-400 rounded-full px-[8px] py-[2px] tabular-nums"
            >
              {o.completed}
            </span>
          ))}
          {hidden > 0 && <span className="text-count text-neutral-650">+{hidden} more in the archive</span>}
        </div>
      )}
    </div>
  );
}

/** Full-screen task detail overlay: header actions, metadata, subtasks and a
 * markdown description editor with preview. Renders nothing when no task is open.
 * In `routed` mode (the /app/task/<id> page) the in-panel Back / Open buttons are
 * hidden — the breadcrumb handles that — and parent/subtask navigation pushes the
 * matching task route. */
export function TaskDetailPanel({ routed = false }: { routed?: boolean } = {}) {
  const { statusMeta, colorOf, clientName, assetUrl, reopen, toggleWorked, markDone, openEdit: onEdit, deleteTask: onDelete, saveDescription: onSaveDescription, openSubtaskForm, addNote, deleteNote, openTagSearch } = useData();
  const { selectedDate, descDraft, setDescDraft, descMode, setDescMode, setDetailId, noteDraft, setNoteDraft, confirm } = useUi();
  const { task, parent, subtasks, occurrences, descDirty } = useDetailData();
  // Notes render Markdown too; the description's own resolver lives inside
  // `DescriptionEditor`.
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);
  if (!task) {
    return null;
  }
  const onBack = () => setDetailId(null);
  const onOpenTask = (id: string) => (routed ? navigateToTask(id) : setDetailId(id));
  const onSetCompletedDate = (taskId: string, date: string) => worklogStore.setCompletedDate(taskId, date);
  const onSetDue = (date: string) => worklogStore.updateTask(task.id, { due: date });
  const notes = task.notes ?? [];
  const onAddNote = () => {
    const text = noteDraft.trim();
    if (!text) {
      return;
    }
    addNote(task.id, text);
    setNoteDraft('');
  };
  const onDeleteNote = async (index: number) => {
    const ok = await confirm.ask({
      title: 'Delete this note?',
      message: 'It is removed from the task file and cannot be recovered.',
      confirmLabel: 'Delete note',
      tone: 'danger',
    });
    if (ok) {
      deleteNote(task.id, index);
    }
  };
  // General to-dos are open or closed only — no worked-on marking.
  const isTodo = isGeneralTodoClientId(clientIdOf(task));
  const worked = !isTodo && workedOnDate(task, selectedDate);
  const subtasksDone = subtasks.filter(isDone).length;
  const overdue = isOverdue(task, selectedDate);
  const lateBy = daysOverdue(task, selectedDate);
  return (
    <div className={'fixed inset-0 z-40 bg-white overflow-auto' + (routed ? '' : ' top-13 md:top-0 md:left-57')}> {/* clears the mobile top bar (h-13) and the 228px (w-57) desktop sidebar rail */}
      <div className="max-w-[860px] mx-auto px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {routed ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-control text-neutral-700 min-w-0">
              <LinkButton size="inherit" onClick={navigateToDashboard}>
                Worklog
              </LinkButton>
              {parent && (
                <>
                  <span className="text-neutral-600">/</span>
                  <LinkButton size="inherit" onClick={() => onOpenTask(parent.id)} className="truncate max-w-[220px]">
                    {parent.title}
                  </LinkButton>
                </>
              )}
              <span className="text-neutral-600">/</span>
              <span className="text-neutral-825 font-medium truncate max-w-[280px]">{task.title}</span>
            </nav>
          ) : (
            <Button size="xs" onClick={onBack}>
              <span className="text-[15px] leading-none">‹</span> Back
            </Button>
          )}
          <div className="flex flex-wrap gap-[8px]">

            {!isTodo && (
              <button
                onClick={() => toggleWorked(task)}
                title={worked ? 'Unmark worked on this day' : 'Mark worked on this day'}
                className={
                  'flex items-center gap-[6px] px-[14px] py-[7px] border rounded-control font-semibold text-control cursor-pointer ' +
                  (worked
                    ? 'border-brand-500 bg-brand-225 text-brand-650 hover:bg-brand-275'
                    : 'border-brand-400 bg-brand-100 text-brand-625 hover:bg-brand-200')
                }
              >
                <BriefcaseIcon className="w-[13px] h-[13px]" />
                {worked ? 'Worked marked' : 'Mark worked'}
              </button>
            )}
            {isDone(task) ? (
              <Button onClick={() => reopen(task)}>Reopen</Button>
            ) : (
              <Button variant="success" onClick={() => markDone(task)} title="Completes this task and all its subtasks">
                <CheckIcon size={13} strokeWidth={2.2} />
                Mark done
              </Button>
            )}
            <Button onClick={() => onEdit(task)}>Edit details</Button>
            {!isDone(task) && <Button onClick={() => openSubtaskForm(task)}>Add subtask</Button>}
            <Button variant="danger" onClick={() => onDelete(task.id, { permanent: isDone(task) })}>
              {isDone(task) ? 'Delete forever' : 'Delete'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-[10px] mb-3">
          {!isTodo && (
            <span className="text-status font-bold tracking-status" style={{ color: statusMeta(task.status, isDone(task)).color }}>
              {statusMeta(task.status, isDone(task)).label}
            </span>
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
              <Chip
                key={tag}
                variant="tag"
                onClick={() => openTagSearch(tag)}
                title={`Show everything tagged "${tag}"`}
              >
                {tag}
              </Chip>
            ),
          )}
        </div>
        {/* A recurring task's due date is the series' next occurrence and is
            managed by the rule — editing it by hand here would fight the roll
            forward, so the repeat summary states it instead. */}
        {!isDone(task) && !task.repeat && (
          <div className="flex items-center gap-[10px] mb-4 text-control text-neutral-700">
            <span className={'font-semibold ' + (overdue ? 'text-danger-675' : '')}>{overdue ? 'Overdue · due' : 'Due'}</span>
            {/* Overdue is a validation state, not a colour choice — `invalid`
                is what paints the border and the text red. */}
            <DateInput
              size="sm"
              invalid={overdue}
              value={task.due ?? ''}
              onChange={(e) => onSetDue(e.target.value)}
              aria-label="Due date"
            />
            {overdue && <span className="text-chip text-danger-675">{formatDaysLate(lateBy)}</span>}
            {task.due && (
              <LinkButton size="xs" onClick={() => onSetDue('')}>
                Clear
              </LinkButton>
            )}
          </div>
        )}
        {!isDone(task) && <RepeatSummary task={task} occurrences={occurrences} overdue={overdue} />}
        {isDone(task) && (
          <div className="flex items-center gap-[10px] mb-4 text-control text-neutral-700">
            <span className="font-semibold">Completed on</span>
            <DateInput
              size="sm"
              value={task.completed ?? ''}
              onChange={(e) => {
                const nextDate = e.target.value;
                if (nextDate) {
                  onSetCompletedDate(task.id, nextDate);
                }
              }}
              aria-label="Completion date"
            />
          </div>
        )}
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

        {subtasks.length > 0 && (
          <div className="mb-7">
            <SectionLabel className="mb-[10px]">
              Subtasks · {subtasksDone}/{subtasks.length} done
            </SectionLabel>
            <Card padding="list" radius="panel">
              {subtasks.map((c) => (
                <div key={c.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-175">
                  {isDone(c) ? (
                    <span className="w-[16px] h-[16px] shrink-0 rounded-full bg-success-500 text-white flex items-center justify-center">
                      <CheckIcon size={10} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <button onClick={() => markDone(c)} title="Mark done" className="w-[16px] h-[16px] shrink-0 border-[1.5px] border-neutral-575 rounded-full bg-white cursor-pointer p-0 hover:border-success-500" />
                  )}
                  <span className="w-16 shrink-0 text-status font-bold tracking-status" style={{ color: statusMeta(c.status, isDone(c)).color }}>
                    {statusMeta(c.status, isDone(c)).label}
                  </span>
                  <span onClick={() => onOpenTask(c.id)} title="Open task" className={'text-body flex-1 cursor-pointer hover:underline ' + (isDone(c) ? 'line-through decoration-neutral-550 text-neutral-700' : 'text-neutral-825')}>
                    {c.title}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}

        <DescriptionEditor
          value={descDraft}
          onChange={setDescDraft}
          mode={descMode}
          onModeChange={setDescMode}
          action={
            descDirty && (
              <Button variant="primary" size="xs" onClick={onSaveDescription} className="font-semibold">
                Save
              </Button>
            )
          }
        />

        <div className="mt-9">
          <SectionLabel className="mb-[10px]">Notes{notes.length > 0 ? ` · ${notes.length}` : ''}</SectionLabel>
          {notes.length > 0 ? (
            <div className="flex flex-col gap-[10px] mb-3">
              {notes.map((n, i) => (
                <Card key={i} tone="muted" radius="panel" className="group px-[16px] py-[11px]">
                  <div className="flex items-center justify-between mb-[5px]">
                    <span className="text-count font-semibold text-neutral-650">{n.timestamp}</span>
                    <LinkButton
                      size="inherit"
                      tone="muted"
                      onClick={() => onDeleteNote(i)}
                      title="Delete note"
                      className="text-count opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </LinkButton>
                  </div>
                  <div className="wl-md text-control-lg leading-[1.6]" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.text, resolveImage) }} />
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState size="sm" className="mb-3">No notes yet. Add one below to track progress on this task.</EmptyState>
          )}
          <div className="flex flex-col gap-2">
            <TextArea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  onAddNote();
                }
              }}
              aria-label="New note"
              placeholder="Add a note… (⌘/Ctrl+Enter to save). Supports Markdown."
              className="w-full min-h-[68px] leading-[1.55]"
            />
            <div className="flex justify-end">
              <Button variant="primary" size="xs" onClick={onAddNote} disabled={!noteDraft.trim()} className="font-semibold">
                Add note
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
