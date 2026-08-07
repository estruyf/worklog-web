import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData, usePublishTaskFormBar } from '../context';
import { TagPicker } from './TagPicker';
import { RecurrencePicker } from './RecurrencePicker';
import { DescriptionEditor } from './DescriptionEditor';
import { LinksField } from './LinksField';
import { ClientChipPicker, DueField, FormActionBar, PriorityField, TitleField } from './task-form';
import { ParentPicker } from './ParentPicker';
import { LinkButton, SidebarSection } from '../primitives';
import { canHaveParent, clientIdOf, parentCandidates } from '../utils';
import { formatRecurrence, type RecurrenceAnchor } from '../../model/recurrence';
import { generalTodoClient } from '../../model/todos';
import { NORMAL_PRIORITY_ID, priorityBucket } from '../../model/priority';
import type { Client, Task } from '../../model/types';
import type { TaskFormFields } from '../model';
import { closeTaskForm, navigateToDashboard, useRoute, useTaskFormInstance, type TaskFormSeed } from '../router';

/** The fields a form starts with: the task's own values when editing, the seed's
 *  when adding. Read once, at mount — from there the form owns them, and a fresh
 *  start means a fresh mount rather than a reset. */
function initialFields(task: Task | undefined, seed: TaskFormSeed): TaskFormFields {
  if (!task) {
    const seeded = (seed.links ?? []).map((l) => ({ url: l.url, label: l.label ?? '' }));
    return {
      title: seed.title ?? '',
      clientId: seed.clientId ?? '',
      priority: seed.priority ?? NORMAL_PRIORITY_ID,
      parentId: seed.parentId ?? '',
      links: seeded.length ? seeded : [{ url: '', label: '' }],
      due: seed.due ?? '',
      repeat: '',
      repeatFrom: 'schedule',
      repeatUntil: '',
      tags: seed.tags ?? [],
      description: seed.description ?? '',
    };
  }
  const ls = task.links.map((l) => ({ url: l.url, label: l.label ?? '' }));
  return {
    title: task.title,
    clientId: clientIdOf(task),
    // Through the bucket, so a task carrying a value off the scale opens on the
    // option it actually sorts as rather than on a blank select.
    priority: priorityBucket(task.priority),
    parentId: task.parentId || '',
    links: ls.length ? ls : [{ url: '', label: '' }],
    due: task.due || '',
    repeat: task.repeat ? formatRecurrence(task.repeat) : '',
    repeatFrom: task.repeat?.anchor ?? 'schedule',
    repeatUntil: task.repeat?.until ?? '',
    tags: task.tags ?? [],
    description: task.description || '',
  };
}

/** The client a seed's `clientId` refers to, or '' if it refers to nothing.
 *
 *  An in-app open always seeds a real id and resolves to itself. A deeplink seeds
 *  whatever the caller wrote, so a name or a differently-cased id resolves too —
 *  an extension shouldn't have to know Worklog's internal ids to address a client.
 *  Anything unrecognized is cleared rather than kept: a bogus id would leave the
 *  picker showing nothing while the form still counted itself saveable, and the
 *  task would land in a client file that doesn't exist. Archived clients resolve
 *  (the seed can legitimately name one), as does the reserved to-do bucket, which
 *  is a client for form purposes but isn't in the configured list. */
function resolveSeedClientId(seed: string | undefined, clients: Client[]): string {
  if (!seed) {
    return '';
  }
  const known = [...clients, generalTodoClient()];
  if (known.some((c) => c.id === seed)) {
    return seed;
  }
  const needle = seed.toLowerCase();
  return known.find((c) => c.id.toLowerCase() === needle || c.name.toLowerCase() === needle)?.id ?? '';
}

/** Resolves what the form should start from, then mounts it under a key that
 * changes whenever it should start over — a different task, or another visit to
 * /app/new from somewhere else in the app. The remount *is* the reset, so the
 * fields below never have to be cleared or re-seeded by hand.
 *
 * Mounting waits for the snapshot: seeding a form from tasks that haven't loaded
 * would leave it empty for good, since nothing re-seeds it afterwards. */
export function TaskFormPage() {
  const { snap, tasks, allClients, defaultFormClientId } = useData();
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-white text-body text-neutral-675">
        This task no longer exists.
        <LinkButton size="inherit" onClick={navigateToDashboard}>
          ‹ Back to Worklog
        </LinkButton>
      </div>
    );
  }

  // A form reached by URL alone (a pasted link, a reload) carries no seed, so the
  // default client is worked out here instead — and so is a deeplink's, when what
  // it asked for isn't a client this repo has.
  const seed = editingId
    ? {}
    : { ...instance.seed, clientId: resolveSeedClientId(instance.seed.clientId, allClients) || defaultFormClientId() };

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
 * Laid out the way an issue tracker lays out an issue: title, description and
 * links take the full width of the main column, and everything that classifies
 * the task — client, parent, dates, tags, repeat — sits in a rail on the right.
 * The description is the field that actually benefits from space, and stacking
 * every property above it used to push it below the fold. Links are in the main
 * column for the same reason: a url is long, and in the 320px rail it was a
 * scrolling input you couldn't read what you'd typed into. Below lg the rail
 * unstacks and follows the description, since two columns don't fit. */
function TaskForm({ editingId, task, seed }: { editingId: string | null; task: Task | undefined; seed: TaskFormSeed }) {
  // Read once, at mount — later renders of the parent must not reach back in and
  // overwrite what has been typed since.
  const [initial] = useState(() => initialFields(task, seed));
  const [title, setTitle] = useState(initial.title);
  const [clientId, setClientId] = useState(initial.clientId);
  const [priority, setPriority] = useState(initial.priority);
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

  const { tasks, allTags, submitTask, deleteTask: onDelete } = useData();
  // Usage-ranked, so the picker offers the tags actually in circulation first.
  const knownTags = useMemo(() => allTags.map((t) => t.tag), [allTags]);
  const parentOptions = useMemo(
    () => parentCandidates(tasks, { id: editingId, clientId, parentId }),
    [tasks, clientId, editingId, parentId],
  );
  const canParent = canHaveParent(tasks, editingId);
  const canAdd = title.trim().length > 0 && !!clientId;

  const onSave = () =>
    submitTask(editingId, {
      title,
      clientId,
      priority,
      parentId,
      links,
      due,
      repeat,
      repeatFrom,
      repeatUntil,
      tags,
      description,
    });

  // Changing client invalidates the parent, whose options are that client's tasks.
  const onPickClient = (id: string) => {
    setClientId(id);
    setParentId('');
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
      <div className="flex-1 max-w-[920px] xl:max-w-[1280px] mx-auto w-full px-5 py-6 md:px-8">
        <h1 className="text-[22px] font-bold m-0 mb-6">{editingId ? 'Edit task' : 'New task'}</h1>

        {/* Below lg this is one ordered column rather than two: `contents`
            dissolves the column wrappers so their blocks become siblings, and the
            client picker can sit right under the title — picking who the task is
            for belongs with naming it — while the rest of the properties follow
            the description and its links. At lg the wrappers become real columns
            again and the order utilities go inert, since the blocks are no longer
            flex items. */}
        <div className="flex flex-col lg:flex-row lg:gap-8">
          <div className="contents lg:block lg:flex-1 lg:min-w-0">
            <div className="order-1">
              <TitleField value={title} onChange={setTitle} onSubmit={onSave} />
            </div>

            <div className="order-3">
              {/* Write / Preview as tabs on the editor itself rather than a toggle
                  floating beside the label: the two modes swap the same box, so the
                  control belongs on the box. */}
              <DescriptionEditor
                variant="boxed"
                hint="optional, Markdown"
                value={description}
                onChange={setDescription}
                mode={descMode}
                onModeChange={setDescMode}
                // Nothing is written until the form is saved, so a ticked box is
                // just another edit to the draft.
                onTaskToggle={setDescription}
              />
            </div>

            {/* Under the description, at the main column's width: the url and its
                label sit side by side and a full github.com/…/pull/34 is readable
                without scrolling the input. */}
            <div className="order-4 mt-[22px]">
              {/* A plain label rather than a `Field`: this block is a repeater of
                  controls, and a `Field` would hand its one generated id to every
                  url and label input in the list. */}
              <span className="block font-semibold text-body mb-[10px]">
                Links <span className="text-neutral-625 font-normal">(optional)</span>
              </span>
              <LinksField value={links} onChange={setLinks} keepOne urlPlaceholder="https://github.com/.../pull/34" />
            </div>
          </div>

          <aside className="contents lg:block lg:w-[320px] lg:shrink-0 lg:border-l lg:border-neutral-375 lg:pl-8">
            <div className="order-2">
              <ClientChipPicker value={clientId} onChange={onPickClient} />
            </div>

            <div className="order-5 mt-[22px] lg:mt-0">
              {/* Titled by the section rather than a `Field`: the picker is a
                  button, and a `<label>` has nothing in here to point at. Hidden
                  outright when the task is already a parent — see
                  `canHaveParent` — rather than shown empty. */}
              {canParent && (
                <SidebarSection title="Parent" hint="optional">
                  <ParentPicker value={parentId} options={parentOptions} onSelect={setParentId} />
                </SidebarSection>
              )}

              <PriorityField value={priority} onChange={setPriority} />

              {!repeat.trim() && <DueField value={due} onChange={setDue} />}

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
            </div>
          </aside>
        </div>
      </div>

      <FormActionBar editingId={editingId} canSave={canAdd} onSave={onSave} onDelete={onDelete} />
    </div>
  );
}
