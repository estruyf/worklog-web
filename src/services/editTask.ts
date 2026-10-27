// Change or close a task from outside the app — behind the CLI's `update` and
// `done` commands. Unlike logWork and addTask these never create a task: the
// caller points at one that exists (by id, link or title), and a pointer that
// matches nothing, or more than one open task, is an error rather than a guess.
//
// Both are idempotent, because the CLI replays them after a lost push race: a
// field that already has the asked-for value is not written, and closing a task
// that is already closed changes nothing.

import { Store } from '../store';
import type { Task } from '../model/types';
import { writablePriority } from '../model/priority';
import { closeTaskById, setTaskStatus, updateTask, type TaskFields } from './taskOps';
import { normalizeUrl } from './logWork';
import { today } from '../util/date';

/** How the caller names a task. `clientId` narrows a link or title match. */
export interface TaskRef {
  taskId?: string;
  link?: string;
  title?: string;
  clientId?: string;
}

export interface TaskEdit {
  /** New title. */
  title?: string;
  /** YYYY-MM-DD, or null to clear it. */
  due?: string | null;
  /** A priority id; 'normal' clears it. */
  priority?: string;
  /** '' clears it. */
  description?: string;
  /** A status id from the timesheet's config. A closing one closes the task. */
  status?: string;
  addTags?: string[];
  removeTags?: string[];
  /** The parent task's id, or null to make it a top-level task again. */
  parentId?: string | null;
}

export interface EditTaskResult {
  task: Task;
  /** The fields that actually changed, in the order they were given. */
  changed: string[];
}

export interface CloseTaskResult {
  task: Task;
  closed: boolean;
}

/** The one task `ref` points at. Open tasks win; a closed one is only found
 *  when `includeClosed` asks for it and no open task matches. */
export function requireTask(store: Store, ref: TaskRef, { includeClosed = false } = {}): Task {
  if (ref.taskId) {
    const byId = store.db.getTask(ref.taskId);
    if (!byId) {
      throw new Error(`Task ${ref.taskId} not found.`);
    }
    return byId;
  }
  if (!ref.link && !ref.title) {
    throw new Error('Name the task with an id, a link or a title.');
  }
  const scoped = store.db
    .getAllTasks()
    .filter((t) => !ref.clientId || t.clientIds.includes(ref.clientId));
  const link = ref.link ? normalizeUrl(ref.link) : undefined;
  const title = ref.title?.trim().toLowerCase();
  const matches = scoped.filter((t) =>
    link ? t.links.some((l) => normalizeUrl(l.url) === link) : t.title.trim().toLowerCase() === title,
  );
  const named = link ? `linked to ${ref.link}` : `called "${ref.title}"`;

  const open = matches.filter((t) => !t.completed);
  if (open.length > 1) {
    const list = open.map((t) => `${t.id} (${t.sourceFile})`).join(', ');
    throw new Error(`Several open tasks are ${named}: ${list}. Pass --id, or --client to narrow it down.`);
  }
  if (open.length === 1) {
    return open[0];
  }
  // The most recently closed one: a title is reused over time (a recurring
  // task leaves one closed copy per occurrence), and the latest is the one
  // the caller just closed.
  const closed = matches
    .filter((t) => t.completed)
    .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? ''))[0];
  if (includeClosed && closed) {
    return closed;
  }
  throw new Error(`No open task is ${named}${ref.clientId ? ` for client "${ref.clientId}"` : ''}.`);
}

export async function editTask(store: Store, ref: TaskRef, edit: TaskEdit): Promise<EditTaskResult> {
  let task = requireTask(store, ref);
  const fields: TaskFields = {};
  const changed: string[] = [];

  const title = edit.title?.trim();
  if (title && title !== task.title) {
    fields.title = title;
    changed.push('title');
  }
  if (edit.due !== undefined && (edit.due ?? undefined) !== task.due) {
    fields.due = edit.due ?? '';
    changed.push('due');
  }
  if (edit.priority !== undefined && writablePriority(edit.priority) !== writablePriority(task.priority)) {
    fields.priority = edit.priority;
    changed.push('priority');
  }
  if (edit.description !== undefined && (edit.description.trim() || undefined) !== task.description) {
    fields.description = edit.description;
    changed.push('description');
  }
  if (edit.addTags?.length || edit.removeTags?.length) {
    const current = task.tags ?? [];
    const remove = new Set((edit.removeTags ?? []).map((t) => t.trim().toLowerCase()));
    const kept = current.filter((t) => !remove.has(t.toLowerCase()));
    const added = (edit.addTags ?? [])
      .map((t) => t.trim())
      .filter((t) => t && !kept.some((k) => k.toLowerCase() === t.toLowerCase()));
    const tags = [...kept, ...added];
    if (tags.join('\n') !== current.join('\n')) {
      fields.tags = tags;
      changed.push('tags');
    }
  }
  if (edit.parentId !== undefined && (edit.parentId ?? undefined) !== task.parentId) {
    if (edit.parentId) {
      requireParent(store, edit.parentId, task.id);
    }
    fields.parentId = edit.parentId ?? '';
    changed.push('parent');
  }

  if (Object.keys(fields).length > 0) {
    task = await updateTask(store, task.id, fields);
  }

  if (edit.status !== undefined && edit.status !== task.status) {
    const statuses = store.getConfig().statuses;
    if (!statuses.some((s) => s.id === edit.status)) {
      throw new Error(`Unknown status "${edit.status}". Known: ${statuses.map((s) => s.id).join(', ')}.`);
    }
    task = await setTaskStatus(store, task.id, edit.status);
    changed.push('status');
  }

  return { task: store.db.getTask(task.id) ?? task, changed };
}

export async function closeTask(store: Store, ref: TaskRef): Promise<CloseTaskResult> {
  const task = requireTask(store, ref, { includeClosed: true });
  // A recurring task stays open when it's done — it rolls on — so "done today"
  // is what tells a repeat of this call from a second occurrence.
  if (task.completed || (task.repeat && task.lastDone === today())) {
    return { task, closed: false };
  }
  const closed = await closeTaskById(store, task.id);
  return { task: store.db.getTask(task.id) ?? closed, closed: true };
}

/** A parent has to exist, and can't be the task itself or one of its own subtasks. */
export function requireParent(store: Store, parentId: string, childId?: string): Task {
  const parent = store.db.getTask(parentId);
  if (!parent) {
    throw new Error(`Parent task ${parentId} not found.`);
  }
  for (let p: Task | undefined = parent; p; p = p.parentId ? store.db.getTask(p.parentId) : undefined) {
    if (p.id === childId) {
      throw new Error(`Task ${childId} can't go under ${parentId}: that is the task itself or one of its subtasks.`);
    }
  }
  return parent;
}
