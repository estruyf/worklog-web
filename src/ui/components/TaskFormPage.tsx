import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData, usePublishTaskFormBar } from '../context';
import { TagPicker } from './TagPicker';
import { RecurrencePicker } from './RecurrencePicker';
import { useMarkdownImages } from '../hooks';
import { Button, DateInput, Field, Input, LinkButton, Select } from '../primitives';
import { clientIdOf, isDone, linksOf, renderMarkdown, makeImageResolver } from '../utils';
import { GENERAL_TODO_CLIENT_ID, GENERAL_TODO_COLOR, GENERAL_TODO_LABEL } from '../../model/todos';
import { formatRecurrence, type RecurrenceAnchor } from '../../model/recurrence';
import type { Task } from '../../model/types';
import type { TaskFormFields } from '../model';
import { closeTaskForm, navigateToDashboard, useRoute, useTaskFormInstance, type TaskFormSeed } from '../router';
import { today } from '../../util/date';

/** The fields a form starts with: the task's own values when editing, the seed's
 *  when adding. Read once, at mount — from there the form owns them, and a fresh
 *  start means a fresh mount rather than a reset. */
function initialFields(task: Task | undefined, seed: TaskFormSeed): TaskFormFields {
  if (!task) {
    return {
      title: '',
      clientId: seed.clientId ?? '',
      parentId: seed.parentId ?? '',
      links: [''],
      due: seed.due ?? '',
      repeat: '',
      repeatFrom: 'schedule',
      repeatUntil: '',
      tags: [],
      description: '',
    };
  }
  const ls = linksOf(task);
  return {
    title: task.title,
    clientId: clientIdOf(task),
    parentId: task.parentId || '',
    links: ls.length ? ls : [''],
    due: task.due || '',
    repeat: task.repeat ? formatRecurrence(task.repeat) : '',
    repeatFrom: task.repeat?.anchor ?? 'schedule',
    repeatUntil: task.repeat?.until ?? '',
    tags: task.tags ?? [],
    description: task.description || '',
  };
}

/** One labelled block in the form's right-hand rail. The rule above each block
 *  is what keeps a stack of unrelated fields readable at this width — there's no
 *  room for the whitespace a single column would use. `divider` is off for the
 *  block that opens the rail, which has nothing above it to be separated from. */
function SidebarSection({
  title,
  hint,
  divider = true,
  children,
}: {
  title?: string;
  hint?: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={'pb-[18px] ' + (divider ? 'border-t border-neutral-375 pt-[18px]' : '')}>
      {title && (
        <label className="block font-semibold text-[14px] mb-[10px]">
          {title} {hint && <span className="text-neutral-625 font-normal">({hint})</span>}
        </label>
      )}
      {children}
    </section>
  );
}

/** Resolves what the form should start from, then mounts it under a key that
 * changes whenever it should start over — a different task, or another visit to
 * /app/new from somewhere else in the app. The remount *is* the reset, so the
 * fields below never have to be cleared or re-seeded by hand.
 *
 * Mounting waits for the snapshot: seeding a form from tasks that haven't loaded
 * would leave it empty for good, since nothing re-seeds it afterwards. */
export function TaskFormPage() {
  const { snap, tasks, defaultFormClientId } = useData();
  const route = useRoute();
  const instance = useTaskFormInstance();

  if (!snap) {
    return null;
  }

  const editingId = route.name === 'taskForm' ? route.taskId : null;
  const task = editingId ? tasks.find((t) => t.id === editingId) : undefined;

  // An edit URL for a task that isn't there (deleted, or a stale link) has nothing
  // to start the fields from, so say so instead of showing an empty "edit" form.
  if (editingId && !task) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-white text-[14px] text-neutral-675">
        This task no longer exists.
        <LinkButton size="inherit" onClick={navigateToDashboard}>
          ‹ Back to Worklog
        </LinkButton>
      </div>
    );
  }

  // A form reached by URL alone (a pasted link, a reload) carries no seed, so the
  // default client is worked out here instead.
  const seed = editingId ? {} : { ...instance.seed, clientId: instance.seed.clientId || defaultFormClientId() };

  return <TaskForm key={`${editingId ?? 'new'}:${instance.key}`} editingId={editingId} task={task} seed={seed} />;
}

/** The new / edit task view (/app/new and /app/task/<id>/edit). A routed view
 * rather than a dialog: the form is long enough that a centred modal runs past the
 * bottom of a short viewport with no way to scroll to the buttons. It renders in
 * the dashboard's main column, so the nav stays where it is.
 *
 * Owns its fields outright. They used to live in app-wide UI state, which meant
 * every keystroke here re-rendered every view and modal subscribed to it, and
 * "which task are these fields for" had to be tracked separately from the route.
 * Both problems come from the same place, and both go away when the fields sit in
 * the component that edits them.
 *
 * Laid out the way an issue tracker lays out an issue: title and description take
 * the full width of the main column, and everything that classifies the task —
 * client, parent, dates, tags, repeat, links — sits in a rail on the right. The
 * description is the field that actually benefits from space, and stacking every
 * property above it used to push it below the fold. Below lg the rail unstacks
 * and follows the description, since two columns don't fit. */
function TaskForm({ editingId, task, seed }: { editingId: string | null; task: Task | undefined; seed: TaskFormSeed }) {
  // Read once, at mount — later renders of the parent must not reach back in and
  // overwrite what has been typed since.
  const [initial] = useState(() => initialFields(task, seed));
  const [title, setTitle] = useState(initial.title);
  const [clientId, setClientId] = useState(initial.clientId);
  const [parentId, setParentId] = useState(initial.parentId);
  const [links, setLinks] = useState(initial.links);
  const [due, setDue] = useState(initial.due);
  const [repeat, setRepeat] = useState(initial.repeat);
  const [repeatFrom, setRepeatFrom] = useState<RecurrenceAnchor>(initial.repeatFrom);
  const [repeatUntil, setRepeatUntil] = useState(initial.repeatUntil);
  const [tags, setTags] = useState(initial.tags);
  const [description, setDescription] = useState(initial.description);
  // An existing description opens as a preview; an empty one opens ready to type.
  const [descMode, setDescMode] = useState<'preview' | 'edit'>(initial.description ? 'preview' : 'edit');
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const { snap, tasks, clients, allClients, colorOf, assetUrl, allTags, submitTask, createClient, deleteTask: onDelete } = useData();
  // Usage-ranked, so the picker offers the tags actually in circulation first.
  const knownTags = useMemo(() => allTags.map((t) => t.tag), [allTags]);
  const parentOptions = useMemo(
    () => tasks.filter((t) => clientIdOf(t) === clientId && !t.parentId && !isDone(t) && t.id !== editingId),
    [tasks, clientId, editingId],
  );
  const canAdd = title.trim().length > 0 && !!clientId;
  // Archived clients aren't offered for new work, but a task already filed under
  // one keeps showing it — otherwise editing that task looks unassigned and the
  // next click silently moves it to another client.
  const pickableClients = useMemo(() => {
    const current = allClients.find((c) => c.id === clientId);
    return current?.archived ? [...clients, current] : clients;
  }, [clients, allClients, clientId]);
  // The snapshot's day rolls over with the app; fall back to the clock before the
  // first snapshot lands so the shortcut is never a stale or empty date.
  const todayKey = snap?.today || today();
  const img = useMarkdownImages(description, setDescription);
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);

  const onSave = () =>
    submitTask(editingId, { title, clientId, parentId, links, due, repeat, repeatFrom, repeatUntil, tags, description });

  // Adding a client from inside the form switches to it once the write lands.
  const onCreateClient = async (name: string) => {
    const id = await createClient(name);
    if (id) {
      setClientId(id);
      setParentId('');
      setAddingClient(false);
      setNewClientName('');
    }
  };

  // Saving goes through a ref so the subscribers below don't have to re-bind on
  // every keystroke. Written after commit, never during render: a render React
  // discards must not leave a listener holding fields that were never shown.
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  });

  // The form owns its shortcuts while it's up — the shell's global handler stands
  // down for this route. Esc leaves, ⌘S / ⌘↵ saves; ⌘S because the browser's own
  // save dialog is what would otherwise open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTaskForm();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter')) {
        e.preventDefault();
        save.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // The form's own actions sit at the bottom of a long scroll; on mobile the top
  // bar is what's always in reach, so the shell offers Save up there too. It needs
  // exactly two things, and this is the whole of what leaves the component.
  const publishBar = usePublishTaskFormBar();
  useEffect(() => {
    publishBar({ canSave: canAdd, submit: () => save.current() });
    return () => publishBar(null);
  }, [canAdd, publishBar]);

  return (
    // Fills the dashboard's main column, so the nav stays put and this reads as a
    // view rather than a separate app. The document scrolls — nothing can be
    // stranded below the fold the way it was in the old dialog — with the header
    // and actions stuck to the top and bottom of the viewport. The mobile header
    // clears the sidebar's own top bar (h-13); at md+ the sidebar is a column and
    // this column starts at the top.
    <div className="flex flex-1 flex-col bg-white">
      <div className="flex-1 max-w-[1240px] mx-auto w-full px-5 py-6 md:px-8">
        <h1 className="text-[22px] font-bold m-0 mb-6">{editingId ? 'Edit task' : 'New task'}</h1>

        {/* Below lg this is one ordered column rather than two: `contents`
            dissolves the column wrappers so their blocks become siblings, and the
            client picker can sit right under the title — picking who the task is
            for belongs with naming it — while the rest of the properties follow
            the description. At lg the wrappers become real columns again and the
            order utilities go inert, since the blocks are no longer flex items. */}
        <div className="flex flex-col lg:flex-row lg:gap-8">
          <div className="contents lg:block lg:flex-1 lg:min-w-0">
            <div className="order-1">
              <Field label="Title" className="mb-[22px]">
                <Input
                  autoFocus
                  size="lg"
                  variant="accent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    // Bare ↵ only: ⌘↵ / ctrl+↵ is the form-wide shortcut above, and
                    // handling it here too saved twice — two tasks from one keypress.
                    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                      onSave();
                    }
                  }}
                  placeholder="Add a title for this task"
                  className="w-full"
                />
              </Field>
            </div>

            <div className="order-3">
              <label className="block font-semibold text-[14px] mb-2">
                Description <span className="text-neutral-625 font-normal">(optional, Markdown)</span>
              </label>
              <input ref={img.fileInputRef} type="file" accept="image/*" multiple onChange={img.onFileChange} className="hidden" />
              {/* Write / Preview as tabs on the editor itself rather than a toggle
                  floating beside the label: the two modes swap the same box, so the
                  control belongs on the box. */}
              <div className="border border-neutral-450 rounded-[10px] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-[10px] py-[7px] border-b border-neutral-450 bg-neutral-150">
                  <div className="flex gap-[6px]">
                    {(['edit', 'preview'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDescMode(mode)}
                        className={
                          'px-[13px] py-[5px] rounded-[7px] text-[13px] cursor-pointer border ' +
                          (descMode === mode ? 'bg-white border-neutral-450 font-semibold text-neutral-825' : 'border-transparent text-neutral-700 hover:text-neutral-825')
                        }
                      >
                        {mode === 'edit' ? 'Write' : 'Preview'}
                      </button>
                    ))}
                  </div>
                  <LinkButton onClick={img.openFilePicker} disabled={img.uploading} className="font-medium">
                    {img.uploading ? 'Adding…' : '+ Add image'}
                  </LinkButton>
                </div>
                <div>
                  {descMode === 'edit' ? (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onPaste={img.onPaste}
                      onDrop={img.onDrop}
                      onDragOver={img.onDragOver}
                      placeholder={'Add a description in Markdown…\n\n## Notes\n- supports **bold**, *italic*, `code`\n- [links](https://example.com), lists, > quotes\n- paste, drop or add an image'}
                      className="block w-full min-h-[300px] lg:min-h-[420px] px-[14px] py-[12px] text-[16px] md:text-[13.5px] leading-[1.6] outline-none focus:outline-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)] resize-y focus-visible:outline-brand-500!"
                      style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
                    />
                  ) : description.trim() ? (
                    // Same minimum height as the editor, so switching tabs doesn't
                    // resize the page under the pointer.
                    <div className="wl-md min-h-[300px] lg:min-h-[420px] px-[8px] py-[4px]" dangerouslySetInnerHTML={{ __html: renderMarkdown(description, resolveImage) }} />
                  ) : (
                    <div onClick={() => setDescMode('edit')} className="min-h-[300px] lg:min-h-[420px] px-[18px] py-[18px] text-[14px] text-neutral-625 italic cursor-text">
                      Nothing to preview yet. Click to add Markdown notes.
                    </div>
                  )}
                </div>
              </div>
              {img.error && <div className="text-[12.5px] text-danger-675 mt-2">{img.error}</div>}
            </div>
          </div>

          <aside className="contents lg:block lg:w-[320px] lg:shrink-0 lg:border-l lg:border-neutral-375 lg:pl-8">
            <div className="order-2">
              <SidebarSection title="Client" divider={false}>
                <div className="flex flex-wrap gap-[10px]">
                  {pickableClients.map((c) => {
                    const active = c.id === clientId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setClientId(c.id);
                          setParentId('');
                        }}
                        title={c.archived ? `${c.name} (archived)` : c.name}
                        className={
                          'flex items-center gap-2 px-[13px] py-[7px] rounded-full text-[13px] font-semibold cursor-pointer border text-neutral-825 ' +
                          (active ? 'border-brand-500 bg-brand-450' : 'border-neutral-525 bg-neutral-350')
                        }
                      >
                        <span className="w-[9px] h-[9px] rounded-full" style={{ background: colorOf(c.id) }} />
                        {c.name}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      setClientId(GENERAL_TODO_CLIENT_ID);
                      setParentId('');
                    }}
                    title="A general to-do not linked to any client"
                    className={
                      'flex items-center gap-2 px-[13px] py-[7px] rounded-full text-[13px] font-semibold cursor-pointer border text-neutral-825 ' +
                      (clientId === GENERAL_TODO_CLIENT_ID ? 'border-brand-500 bg-brand-450' : 'border-neutral-525 bg-neutral-350')
                    }
                  >
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: GENERAL_TODO_COLOR }} />
                    {GENERAL_TODO_LABEL}
                  </button>
                  {!addingClient && (
                    <button onClick={() => setAddingClient(true)} className="flex items-center gap-[6px] px-[13px] py-[7px] border border-dashed border-neutral-550 rounded-full bg-white text-neutral-700 text-[13px] cursor-pointer">
                      + Add client
                    </button>
                  )}
                </div>
                {addingClient && (
                  <div className="flex flex-wrap gap-2 mt-[10px]">
                    <Input
                      autoFocus
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => {
                        // Bare ↵ only, for the same reason as the title field: ⌘↵ here
                        // would add the client *and* save the task in one keypress.
                        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                          void onCreateClient(newClientName);
                        }
                      }}
                      aria-label="New client name"
                      placeholder="New client name"
                      className="flex-1 min-w-[150px]"
                    />
                    <Button variant="primary" size="md" onClick={() => void onCreateClient(newClientName)}>
                      Add
                    </Button>
                    <LinkButton size="lg" onClick={() => setAddingClient(false)}>
                      Cancel
                    </LinkButton>
                  </div>
                )}
              </SidebarSection>
            </div>

            <div className="order-4 mt-[22px] lg:mt-0">
              {/* The label lives in a `Field` rather than on the section, so it
                  points at the select — a section titles a group, and this group
                  is one control. */}
              <SidebarSection>
                <Field label="Parent" hint="optional">
                  <Select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full">
                    <option value="">— none —</option>
                    {parentOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </SidebarSection>

              {/* With a repeat rule this date isn't a deadline — it's where the series
                  starts, and it rolls forward on its own from there. The repeat block
                  owns it in that case, next to the rule it belongs to. */}
              {!repeat.trim() && (
                <SidebarSection>
                  <Field
                    label="Due"
                    hint="optional"
                    action={
                      due && (
                        <LinkButton size="xs" onClick={() => setDue('')}>
                          Clear
                        </LinkButton>
                      )
                    }
                  >
                    <DateInput value={due} onChange={(e) => setDue(e.target.value)} className="w-full" />
                    {/* Today is by far the most common due date, and picking it from the
                        native date input takes more clicks than it's worth. */}
                    <button
                      type="button"
                      onClick={() => setDue(due === todayKey ? '' : todayKey)}
                      className={
                        'mt-2 px-[11px] py-[4px] rounded-full text-[12px] font-semibold cursor-pointer border ' +
                        (due === todayKey ? 'border-brand-500 bg-brand-450 text-brand-800' : 'border-neutral-525 bg-white text-neutral-725 hover:bg-neutral-200')
                      }
                    >
                      Today
                    </button>
                  </Field>
                </SidebarSection>
              )}

              <SidebarSection>
                <RecurrencePicker
                  value={repeat}
                  onChange={setRepeat}
                  anchor={repeatFrom}
                  onAnchorChange={setRepeatFrom}
                  until={repeatUntil}
                  onUntilChange={setRepeatUntil}
                  due={due}
                  onDueChange={setDue}
                />
              </SidebarSection>

              <SidebarSection title="Tags" hint="pick existing or create">
                <TagPicker value={tags} onChange={setTags} known={knownTags} />
              </SidebarSection>

              <SidebarSection title="Links" hint="optional">
                {links.map((l, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input
                      value={l}
                      onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                      aria-label={`Link ${i + 1}`}
                      placeholder="https://github.com/.../pull/34"
                      className="flex-1 min-w-0"
                    />
                    <button
                      onClick={() => {
                        const next = links.filter((_, j) => j !== i);
                        setLinks(next.length ? next : ['']);
                      }}
                      aria-label="Remove link"
                      className="w-[36px] shrink-0 border border-neutral-525 rounded-[9px] bg-white text-neutral-650 cursor-pointer text-[15px]"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <LinkButton size="lg" onClick={() => setLinks([...links, ''])} className="font-medium py-[2px]">
                  + Add another link
                </LinkButton>
              </SidebarSection>
            </div>
          </aside>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-neutral-375">
        <div className="max-w-[1240px] mx-auto w-full flex items-center justify-between px-5 py-3 md:px-8">
          <div>
            {editingId && (
              <Button variant="danger" size="lg" onClick={() => onDelete(editingId)}>
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-[10px]">
            <Button variant="neutral" size="lg" onClick={closeTaskForm}>
              Close
            </Button>
            {/* `submitTask` already returns early without a title or a client, so
                disabling here only surfaces that rule to the keyboard and to
                assistive tech — it doesn't change what a click does. */}
            <Button variant="primary" size="lg" onClick={onSave} disabled={!canAdd}>
              {editingId ? 'Save task' : 'Add task'}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
