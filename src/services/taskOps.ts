// Task mutation services: status change (with close/reopen + cascade), parent
// assignment, and delete (cascade). All operate on markdown; the watcher/rebuild
// refreshes the cache + app state afterwards.

import { Store } from "../store";
import type { Task, TaskNote } from "../model/types";
import {
  inProgressStatusId,
  isTerminalStatus,
  terminalStatusId,
} from "../model/status";
import { parseTaskFile, serializeTask } from "../parser/taskParser";
import { extractBlock, replaceBlock } from "../parser/blocks";
import { readText, writeText } from "../workspace/paths";
import { today, monthOf, nowStamp } from "../util/date";
import { appendArchiveBlock, appendTaskBlock } from "../commands/shared";

/** All descendants of a task (any status), via the cache's parent links. */
export function collectDescendants(store: Store, taskId: string): Task[] {
  const out: Task[] = [];
  const visit = (id: string) => {
    for (const child of store.db.getChildren(id)) {
      out.push(child);
      visit(child.id);
    }
  };
  visit(taskId);
  return out;
}

function isClosed(task: Task): boolean {
  return !!task.completed;
}

/** Change a task's status. Terminal status → close (archive + cascade to open
 *  children); leaving a terminal status → reopen; otherwise edit in place. */
export async function setTaskStatus(
  store: Store,
  taskId: string,
  statusId: string,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  const statuses = store.getConfig().statuses;
  const goingTerminal = isTerminalStatus(statuses, statusId);

  if (goingTerminal && !isClosed(task)) {
    return closeCascade(store, taskId, statusId, today());
  }
  if (!goingTerminal && isClosed(task)) {
    return reopenTask(store, taskId, statusId);
  }
  await updateInPlace(store, task, (t) => ({ ...t, status: statusId }));
  await store.rebuild("setStatus");
  return { ...task, status: statusId };
}

/** Toggle whether a task is marked as worked on a specific day. */
export async function toggleTaskWorkedOn(
  store: Store,
  taskId: string,
  date: string,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  const existing = new Set(task.workedOn ?? []);
  const marking = !existing.has(date);
  if (marking) {
    existing.add(date);
  } else {
    existing.delete(date);
  }
  const workedOn = [...existing].sort();
  // Marking a task as worked on a day also moves it into the in-progress
  // status (unless it's already closed). Un-marking leaves the status alone.
  const wip =
    marking && !isClosed(task)
      ? inProgressStatusId(store.getConfig().statuses)
      : undefined;
  await updateInPlace(store, task, (t) => ({
    ...t,
    workedOn,
    status: wip ?? t.status,
  }));
  await store.rebuild("toggleWorked");
  return { ...task, workedOn, status: wip ?? task.status };
}

/** Set/adjust the completed date for a closed task (used for backfills/planning). */
export async function setTaskCompletedDate(
  store: Store,
  taskId: string,
  date: string,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  if (!isClosed(task)) {
    throw new Error("Only closed tasks have a completed date.");
  }
  await updateInPlace(store, task, (t) => ({ ...t, completed: date }));
  await store.rebuild("setCompletedDate");
  return { ...task, completed: date };
}

/** Append a timestamped progress note to a task (works on open or closed tasks). */
export async function addTaskNote(
  store: Store,
  taskId: string,
  text: string,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot add an empty note.");
  }
  const note: TaskNote = { timestamp: nowStamp(), text: trimmed };
  await updateInPlace(store, task, (t) => ({
    ...t,
    notes: [...(t.notes ?? []), note],
  }));
  await store.rebuild("addNote");
  return store.db.getTask(taskId) ?? task;
}

/** Remove a note by its 0-based index in the task's chronological notes list. */
export async function deleteTaskNote(
  store: Store,
  taskId: string,
  index: number,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  await updateInPlace(store, task, (t) => {
    const notes = [...(t.notes ?? [])];
    if (index >= 0 && index < notes.length) {
      notes.splice(index, 1);
    }
    return { ...t, notes };
  });
  await store.rebuild("deleteNote");
  return store.db.getTask(taskId) ?? task;
}

/** Close a task to the terminal status, cascading to every still-open descendant. */
export async function closeTaskById(
  store: Store,
  taskId: string,
  completedDate = today(),
): Promise<Task> {
  const terminal = terminalStatusId(store.getConfig().statuses);
  return closeCascade(store, taskId, terminal, completedDate);
}

async function closeCascade(
  store: Store,
  taskId: string,
  statusId: string,
  completedDate: string,
): Promise<Task> {
  const root = store.db.getTask(taskId);
  if (!root) {
    throw new Error(`Task ${taskId} not found.`);
  }
  // Close still-open descendants first, then the task itself.
  const openDescendants = collectDescendants(store, taskId).filter(
    (t) => !isClosed(t),
  );
  for (const child of openDescendants) {
    await closeOne(store, child, statusId, completedDate);
  }
  const closed = await closeOne(store, root, statusId, completedDate);
  await store.rebuild("closeTask");
  return closed;
}

/** Move one open task from its client file into the archive, stamped closed. */
async function closeOne(
  store: Store,
  task: Task,
  statusId: string,
  completedDate: string,
): Promise<Task> {
  const clientId = task.clientIds[0];
  const clientName =
    store.db.getClients().find((c) => c.id === clientId)?.name ?? clientId;
  const clientUri = store.ws.clientFile(clientId);
  const content = await readText(clientUri);
  if (content === undefined) {
    throw new Error(`Could not read ${clientId}.md to close "${task.title}".`);
  }
  const extracted = extractBlock(content, task.id);
  if (!extracted) {
    throw new Error(`Could not locate task ${task.id} in ${clientId}.md.`);
  }
  const parsed = parseTaskFile(extracted.block, clientUri, clientId)
    .tasks[0];
  const closed: Task = {
    ...(parsed ?? task),
    status: statusId,
    completed: completedDate,
  };

  await writeText(clientUri, extracted.remainder);
  await appendArchiveBlock(
    store.ws,
    clientId,
    clientName,
    monthOf(closed.completed!),
    serializeTask(closed, clientId),
  );
  return closed;
}

/** Move a closed task back out of the archive into its client file. */
async function reopenTask(
  store: Store,
  taskId: string,
  statusId: string,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  const clientId = task.clientIds[0];
  const client = store.db.getClients().find((c) => c.id === clientId);
  const archiveUri = task.sourceFile;
  const content = await readText(archiveUri);
  if (content === undefined) {
    throw new Error(`Could not read the archive file for "${task.title}".`);
  }
  const extracted = extractBlock(content, task.id);
  if (!extracted) {
    throw new Error(`Could not locate task ${task.id} in the archive.`);
  }
  const parsed = parseTaskFile(extracted.block, archiveUri, clientId)
    .tasks[0];
  const reopened: Task = {
    ...(parsed ?? task),
    status: statusId,
    completed: undefined,
  };

  await writeText(archiveUri, extracted.remainder);
  await appendTaskBlock(
    store.ws,
    client ?? { id: clientId, name: clientId },
    serializeTask(reopened, clientId),
  );
  await store.rebuild("reopenTask");
  return reopened;
}

/** Assign or clear a task's parent (rejects cycles). */
export async function setTaskParent(
  store: Store,
  taskId: string,
  parentId: string | undefined,
): Promise<void> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  if (parentId) {
    if (parentId === taskId) {
      throw new Error("A task cannot be its own parent.");
    }
    if (collectDescendants(store, taskId).some((d) => d.id === parentId)) {
      throw new Error("That parent is a descendant of this task.");
    }
  }
  await updateInPlace(store, task, (t) => ({ ...t, parentId }));
  await store.rebuild("setParent");
}

/** Delete a task and all its descendants from markdown (permanent; git is the trace). */
export async function deleteTaskCascade(
  store: Store,
  taskId: string,
): Promise<{ removed: number }> {
  const root = store.db.getTask(taskId);
  if (!root) {
    throw new Error(`Task ${taskId} not found.`);
  }
  const targets = [root, ...collectDescendants(store, taskId)];
  for (const task of targets) {
    const uri = task.sourceFile;
    const content = await readText(uri);
    if (content === undefined) {
      continue;
    }
    const extracted = extractBlock(content, task.id);
    if (extracted) {
      await writeText(uri, extracted.remainder);
    }
  }
  await store.rebuild("deleteTask");
  return { removed: targets.length };
}

export interface TaskFields {
  title?: string;
  clientId?: string;
  parentId?: string; // '' clears the parent
  links?: string[];
  description?: string; // markdown body; '' clears it
  due?: string; // '' clears the due date
  tags?: string[];
}

/** Edit a task's title / client / parent / links. Same-client edits rewrite the
 *  block in place; a client change moves the block to the new client's file
 *  (or archive folder, if the task is already closed). */
export async function updateTask(
  store: Store,
  taskId: string,
  fields: TaskFields,
): Promise<Task> {
  const task = store.db.getTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }
  const current = task.clientIds[0];
  const target =
    fields.clientId && fields.clientId.trim() ? fields.clientId : current;

  const apply = (t: Task): Task => ({
    ...t,
    title:
      fields.title !== undefined ? fields.title.trim() || t.title : t.title,
    parentId:
      fields.parentId !== undefined ? fields.parentId || undefined : t.parentId,
    links:
      fields.links !== undefined
        ? fields.links.map((u) => ({ url: u }))
        : t.links,
    description:
      fields.description !== undefined
        ? fields.description.trim() || undefined
        : t.description,
    due:
      fields.due !== undefined ? fields.due.trim() || undefined : t.due,
    tags:
      fields.tags !== undefined
        ? fields.tags.map((tag) => tag.trim()).filter(Boolean)
        : t.tags,
  });

  if (target === current) {
    await updateInPlace(store, task, apply);
  } else {
    const uri = task.sourceFile;
    const content = await readText(uri);
    if (content === undefined) {
      throw new Error(`Could not read ${task.sourceFile}.`);
    }
    const extracted = extractBlock(content, task.id);
    if (!extracted) {
      throw new Error(`Could not locate task ${task.id}.`);
    }
    const parsed =
      parseTaskFile(extracted.block, uri, current).tasks[0] ?? task;
    const moved = apply({ ...parsed, clientIds: [target] });
    await writeText(uri, extracted.remainder);
    if (moved.completed) {
      const name =
        store.db.getClients().find((c) => c.id === target)?.name ?? target;
      await appendArchiveBlock(
        store.ws,
        target,
        name,
        monthOf(moved.completed),
        serializeTask(moved, target),
      );
    } else {
      const client = store.db.getClients().find((c) => c.id === target) ?? {
        id: target,
        name: target,
      };
      await appendTaskBlock(store.ws, client, serializeTask(moved, target));
    }
  }
  await store.rebuild("updateTask");
  return store.db.getTask(taskId) ?? task;
}

/** Rewrite a task's block in its current file with a mutated version. */
async function updateInPlace(
  store: Store,
  task: Task,
  mutate: (t: Task) => Task,
): Promise<void> {
  const uri = task.sourceFile;
  const content = await readText(uri);
  if (content === undefined) {
    throw new Error(`Could not read ${task.sourceFile}.`);
  }
  const parsed =
    parseTaskFile(
      extractBlockText(content, task.id),
      uri,
      task.clientIds[0],
    ).tasks[0] ?? task;
  const next = mutate({ ...parsed, clientIds: task.clientIds });
  const replaced = replaceBlock(
    content,
    task.id,
    serializeTask(next, task.clientIds[0]),
  );
  if (replaced === undefined) {
    throw new Error(`Could not locate task ${task.id} to update.`);
  }
  await writeText(uri, replaced.replace(/\s*$/, "") + "\n");
}

function extractBlockText(content: string, taskId: string): string {
  return extractBlock(content, taskId)?.block ?? "";
}
