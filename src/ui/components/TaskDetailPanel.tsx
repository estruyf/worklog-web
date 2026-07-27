import React, { useMemo } from 'react';
import { clientIdOf, isDone, linksOf, renderMarkdown, makeImageResolver, workedOnDate } from '../utils';
import { BriefcaseIcon } from 'lucide-react';
import { isGeneralTodoClientId } from '../../model/todos';
import { useData, useUi } from '../context';
import { useMarkdownImages } from '../hooks';
import { navigateToDashboard, navigateToTask } from '../router';
import { worklogStore } from '../../data/worklogStore';

/** Resolves the task pointed at by detailId plus its parent, subtasks and dirty flag. */
function useDetailData() {
  const { tasks } = useData();
  const { detailId, descDraft } = useUi();
  const task = useMemo(() => (detailId ? tasks.find((t) => t.id === detailId) : undefined), [detailId, tasks]);
  const subtasks = useMemo(() => (task ? tasks.filter((t) => t.parentId === task.id) : []), [task, tasks]);
  const parent = useMemo(() => (task?.parentId ? tasks.find((t) => t.id === task.parentId) : undefined), [task, tasks]);
  return { task, parent, subtasks, descDirty: !!task && descDraft !== (task.description ?? '') };
}

/** Full-screen task detail overlay: header actions, metadata, subtasks and a
 * markdown description editor with preview. Renders nothing when no task is open.
 * In `routed` mode (the /app/task/<id> page) the in-panel Back / Open buttons are
 * hidden — the breadcrumb handles that — and parent/subtask navigation pushes the
 * matching task route. */
export function TaskDetailPanel({ routed = false }: { routed?: boolean } = {}) {
  const { statusMeta, colorOf, clientName, assetsBase, reopen, toggleWorked, markDone, openEdit: onEdit, deleteTask: onDelete, saveDescription: onSaveDescription, openChildModal, addNote, deleteNote } = useData();
  const { selectedDate, descDraft, setDescDraft, descMode, setDescMode, setDetailId, noteDraft, setNoteDraft } = useUi();
  const { task, parent, subtasks, descDirty } = useDetailData();
  const img = useMarkdownImages(descDraft, setDescDraft);
  const resolveImage = useMemo(() => makeImageResolver(assetsBase), [assetsBase]);
  if (!task) {
    return null;
  }
  const onBack = () => setDetailId(null);
  const onOpenTask = (id: string) => (routed ? navigateToTask(id) : setDetailId(id));
  const onOpenInTab = () => navigateToTask(task.id);
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
  const onDeleteNote = (index: number) => {
    if (window.confirm('Delete this note?')) {
      deleteNote(task.id, index);
    }
  };
  // General to-dos are open or closed only — no worked-on marking.
  const isTodo = isGeneralTodoClientId(clientIdOf(task));
  const worked = !isTodo && workedOnDate(task, selectedDate);
  const subtasksDone = subtasks.filter(isDone).length;
  const overdue = !!task.due && !isDone(task) && task.due < selectedDate;
  return (
    <div className={'fixed inset-0 z-40 bg-white overflow-auto' + (routed ? '' : ' top-13 md:top-0 md:left-57')}> {/* clears the mobile top bar (h-13) and the 228px (w-57) desktop sidebar rail */}
      <div className="max-w-[860px] mx-auto px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {routed ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-neutral-700 min-w-0">
              <button onClick={navigateToDashboard} className="hover:underline text-info cursor-pointer bg-transparent border-none p-0">
                Worklog
              </button>
              {parent && (
                <>
                  <span className="text-neutral-600">/</span>
                  <button onClick={() => onOpenTask(parent.id)} className="hover:underline text-info cursor-pointer bg-transparent border-none p-0 truncate max-w-[220px]">
                    {parent.title}
                  </button>
                </>
              )}
              <span className="text-neutral-600">/</span>
              <span className="text-neutral-825 font-medium truncate max-w-[280px]">{task.title}</span>
            </nav>
          ) : (
            <button onClick={onBack} className="flex items-center gap-[6px] text-[13px] text-neutral-700 bg-white border border-neutral-400 rounded-md px-[10px] py-[6px] cursor-pointer hover:bg-neutral-200">
              <span className="text-[15px] leading-none">‹</span> Back
            </button>
          )}
          <div className="flex flex-wrap gap-[8px]">
            {!routed && (
              <button
                onClick={onOpenInTab}
                title="Open this task on its own page"
                className="flex items-center gap-[6px] px-[14px] py-[7px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 font-semibold text-[13px] cursor-pointer hover:bg-neutral-200"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7.5 8.5" />
                </svg>
                Open page
              </button>
            )}
            {!isTodo && (
              <button
                onClick={() => toggleWorked(task)}
                title={worked ? 'Unmark worked on this day' : 'Mark worked on this day'}
                className={
                  'flex items-center gap-[6px] px-[14px] py-[7px] border rounded-[7px] font-semibold text-[13px] cursor-pointer ' +
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
              <button onClick={() => reopen(task)} className="px-[14px] py-[7px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 font-semibold text-[13px] cursor-pointer hover:bg-neutral-200">
                Reopen
              </button>
            ) : (
              <>
                <button onClick={() => markDone(task)} title="Completes this task and all its subtasks" className="flex items-center gap-[6px] px-[14px] py-[7px] border border-success-175 rounded-[7px] bg-success-100 text-success-625 font-semibold text-[13px] cursor-pointer hover:bg-success-125">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  Mark done
                </button>
              </>
            )}
            <button onClick={() => onEdit(task)} className="px-[14px] py-[7px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 font-semibold text-[13px] cursor-pointer hover:bg-neutral-200">
              Edit details
            </button>
            {!isDone(task) && (
              <button onClick={() => openChildModal(task)} className="px-[14px] py-[7px] border border-neutral-400 rounded-[7px] bg-white text-neutral-750 font-semibold text-[13px] cursor-pointer hover:bg-neutral-200">
                Add subtask
              </button>
            )}
            <button onClick={() => onDelete(task.id, { permanent: isDone(task) })} className="px-[14px] py-[7px] border border-danger-225 rounded-[7px] bg-white text-danger-675 font-semibold text-[13px] cursor-pointer hover:bg-danger-75">
              {isDone(task) ? 'Delete forever' : 'Delete'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-[10px] mb-3">
          {!isTodo && (
            <span className="text-[10.5px] font-bold tracking-[0.05em]" style={{ color: statusMeta(task.status, isDone(task)).color }}>
              {statusMeta(task.status, isDone(task)).label}
            </span>
          )}
          <span className="flex items-center gap-[6px] text-[13px] text-neutral-750">
            <span className="w-[8px] h-[8px] rounded-full" style={{ background: colorOf(clientIdOf(task)) }} />
            {clientName(clientIdOf(task))}
          </span>
          {parent && (
            <span className="text-[13px] text-neutral-650">
              · in{' '}
              <button onClick={() => onOpenTask(parent.id)} className="text-info cursor-pointer hover:underline bg-transparent border-none p-0 text-[13px]">
                {parent.title}
              </button>
            </span>
          )}
          {task.tags?.map((tag) => (
            <span key={tag} className="text-[11px] text-neutral-725 bg-neutral-250 border border-neutral-400 rounded-full px-[8px] py-[2px]">
              {tag}
            </span>
          ))}
        </div>
        {!isDone(task) && (
          <div className="flex items-center gap-[10px] mb-4 text-[13px] text-neutral-700">
            <span className={'font-semibold ' + (overdue ? 'text-danger-675' : '')}>{overdue ? 'Overdue · due' : 'Due'}</span>
            <input
              type="date"
              value={task.due ?? ''}
              onChange={(e) => onSetDue(e.target.value)}
              className={'px-3 py-[7px] border rounded-[8px] text-[13px] ' + (overdue ? 'border-danger-225 text-danger-675' : 'border-neutral-525')}
            />
            {task.due && (
              <button onClick={() => onSetDue('')} className="text-[12px] text-info bg-none border-none cursor-pointer">
                Clear
              </button>
            )}
          </div>
        )}
        {isDone(task) && (
          <div className="flex items-center gap-[10px] mb-4 text-[13px] text-neutral-700">
            <span className="font-semibold">Completed on</span>
            <input
              type="date"
              value={task.completed ?? ''}
              onChange={(e) => {
                const nextDate = e.target.value;
                if (nextDate) {
                  onSetCompletedDate(task.id, nextDate);
                }
              }}
              className="px-3 py-[7px] border border-neutral-525 rounded-[8px] text-[13px]"
            />
          </div>
        )}
        <h1 className={'text-[26px] font-bold m-0 mb-5 tracking-[-0.01em] ' + (isDone(task) ? 'line-through decoration-neutral-550 text-neutral-700' : '')}>
          {task.title}
        </h1>

        {linksOf(task).length > 0 && (
          <div className="flex flex-col gap-1 mb-6">
            {task.links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-[7px] text-[13.5px] text-info hover:underline w-fit">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7.5 8.5" />
                </svg>
                {l.label || l.url}
              </a>
            ))}
          </div>
        )}

        {subtasks.length > 0 && (
          <div className="mb-7">
            <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-[10px]">SUBTASKS · {subtasksDone}/{subtasks.length} DONE</div>
            <div className="border border-neutral-375 rounded-[12px] bg-white px-2 py-[6px]">
              {subtasks.map((c) => (
                <div key={c.id} className="flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-175">
                  {isDone(c) ? (
                    <span className="w-[16px] h-[16px] shrink-0 rounded-full bg-success-500 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.5">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </span>
                  ) : (
                    <button onClick={() => markDone(c)} title="Mark done" className="w-[16px] h-[16px] shrink-0 border-[1.5px] border-neutral-575 rounded-full bg-white cursor-pointer p-0 hover:border-success-500" />
                  )}
                  <span className="w-16 shrink-0 text-[10.5px] font-bold tracking-[0.05em]" style={{ color: statusMeta(c.status, isDone(c)).color }}>
                    {statusMeta(c.status, isDone(c)).label}
                  </span>
                  <span onClick={() => onOpenTask(c.id)} title="Open task" className={'text-[14px] flex-1 cursor-pointer hover:underline ' + (isDone(c) ? 'line-through decoration-neutral-550 text-neutral-700' : 'text-neutral-825')}>
                    {c.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-[10px]">
          <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675">DESCRIPTION</div>
          <div className="flex items-center gap-2">
            <button onClick={img.openFilePicker} disabled={img.uploading} className="text-[12px] text-info font-medium cursor-pointer disabled:opacity-50 disabled:cursor-default">
              {img.uploading ? 'Adding…' : '+ Add image'}
            </button>
            <div className="flex border border-neutral-400 rounded-[7px] overflow-hidden text-[12px]">
              <button onClick={() => setDescMode('preview')} className={'px-[10px] py-[4px] cursor-pointer ' + (descMode === 'preview' ? 'bg-brand-225 text-brand-800 font-semibold' : 'bg-white text-neutral-700')}>
                Preview
              </button>
              <button onClick={() => setDescMode('edit')} className={'px-[10px] py-[4px] cursor-pointer border-l border-neutral-400 ' + (descMode === 'edit' ? 'bg-brand-225 text-brand-800 font-semibold' : 'bg-white text-neutral-700')}>
                Edit
              </button>
            </div>
            {descDirty && (
              <button onClick={onSaveDescription} className="px-[14px] py-[5px] border border-brand-500 rounded-[7px] bg-brand-450 text-brand-800 font-semibold text-[12.5px] cursor-pointer hover:bg-brand-475">
                Save
              </button>
            )}
          </div>
        </div>

        <input ref={img.fileInputRef} type="file" accept="image/*" multiple onChange={img.onFileChange} className="hidden" />
        {descMode === 'edit' ? (
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onPaste={img.onPaste}
            onDrop={img.onDrop}
            onDragOver={img.onDragOver}
            placeholder={'Add a description in Markdown…\n\n## Notes\n- supports **bold**, *italic*, `code`\n- [links](https://example.com), lists, > quotes\n- paste, drop or add an image'}
            className="w-full min-h-[280px] px-[14px] py-[12px] border border-neutral-525 rounded-[10px] text-[13.5px] leading-[1.6] outline-none focus:border-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)] resize-y"
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          />
        ) : descDraft.trim() ? (
          <div className="wl-md border border-neutral-375 rounded-[12px] px-[18px] py-[14px] bg-neutral-50" dangerouslySetInnerHTML={{ __html: renderMarkdown(descDraft, resolveImage) }} />
        ) : (
          <div onClick={() => setDescMode('edit')} className="border border-dashed border-neutral-450 rounded-[12px] px-[18px] py-[22px] text-[14px] text-neutral-625 italic cursor-text">
            No description yet. Click to add Markdown notes.
          </div>
        )}
        {img.error && <div className="text-[12.5px] text-danger-675 mt-2">{img.error}</div>}

        <div className="mt-9">
          <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-[10px]">
            NOTES{notes.length > 0 ? ` · ${notes.length}` : ''}
          </div>
          {notes.length > 0 ? (
            <div className="flex flex-col gap-[10px] mb-3">
              {notes.map((n, i) => (
                <div key={i} className="group border border-neutral-375 rounded-[12px] bg-neutral-50 px-[16px] py-[11px]">
                  <div className="flex items-center justify-between mb-[5px]">
                    <span className="text-[11.5px] font-semibold text-neutral-650">{n.timestamp}</span>
                    <button
                      onClick={() => onDeleteNote(i)}
                      title="Delete note"
                      className="text-[11.5px] text-neutral-600 hover:text-danger-675 opacity-0 group-hover:opacity-100 cursor-pointer bg-transparent border-none p-0"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="wl-md text-[13.5px] leading-[1.6]" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.text, resolveImage) }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-neutral-625 italic mb-3">No notes yet. Add one below to track progress on this task.</div>
          )}
          <div className="flex flex-col gap-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  onAddNote();
                }
              }}
              placeholder="Add a note… (⌘/Ctrl+Enter to save). Supports Markdown."
              className="w-full min-h-[68px] px-[14px] py-[10px] border border-neutral-525 rounded-[10px] text-[13.5px] leading-[1.55] outline-none focus:border-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)] resize-y"
            />
            <div className="flex justify-end">
              <button
                onClick={onAddNote}
                disabled={!noteDraft.trim()}
                className="px-[16px] py-[6px] border border-brand-500 rounded-[7px] bg-brand-450 text-brand-800 font-semibold text-[12.5px] cursor-pointer hover:bg-brand-475 disabled:opacity-50 disabled:cursor-default"
              >
                Add note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
