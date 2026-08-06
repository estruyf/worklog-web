// Task/client creation services shared across the app
// commands. All writes go to markdown; the watcher/rebuild then refreshes views.

import { Store } from '../store';
import type { Client, Recurrence, Task, TaskLink } from '../model/types';
import { newTaskId } from '../parser/ids';
import { openStatusId } from '../model/status';
import { serializeTask } from '../parser/taskParser';
import { today } from '../util/date';
import { appendTaskBlock } from '../commands/shared';
import { withSeededDue } from '../model/recurringTask';
import { writeText, readText, ensureDir, deleteFile, listTextPaths, parseClientLinks, parseLinks } from '../workspace/paths';
import { GENERAL_TODO_CLIENT_ID, generalTodoClient, isGeneralTodoClientId } from '../model/todos';

export interface NewTaskInput {
  title: string;
  clientId: string;
  parentId?: string;
  /** Reference links (a bare url string is accepted too). */
  links?: (TaskLink | string)[];
  description?: string;
  due?: string;
  tags?: string[];
  repeat?: Recurrence;
}

export interface NewClientInput {
  name: string;
  /** Optional explicit id; otherwise derived from the name. */
  id?: string;
  /** Optional accent color (hex), used by the dashboard. */
  color?: string;
  /** Optional Markdown notes about the client. */
  description?: string;
  /** Optional reference links (a bare url string is accepted too). */
  links?: (TaskLink | string)[];
}

export interface ClientFields {
  name?: string;
  color?: string;
  /** Pass '' to clear the notes. */
  description?: string;
  /** Pass [] to clear the links. */
  links?: (TaskLink | string)[];
}

export function slugifyClientId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/** Append a new open task to its client file and rebuild. */
export async function createTask(store: Store, input: NewTaskInput): Promise<Task> {
  const title = input.title.trim();
  if (!title) {
    throw new Error('A task title is required.');
  }
  // General to-dos use a reserved pseudo-client that may not exist yet (no file
  // until the first to-do is created), so fall back to its virtual record.
  const client =
    store.db.getClients().find((c) => c.id === input.clientId) ??
    (isGeneralTodoClientId(input.clientId) ? generalTodoClient() : undefined);
  if (!client) {
    throw new Error(`Unknown client "${input.clientId}".`);
  }

  const task: Task = {
    id: newTaskId(),
    title,
    description: input.description?.trim() || undefined,
    // The configured first working status, not the literal 'open': the list is
    // the user's, and a renamed or removed first status would otherwise mint
    // tasks in a status nothing knows about.
    status: openStatusId(store.getConfig().statuses),
    parentId: input.parentId || undefined,
    clientIds: [client.id],
    links: parseLinks(input.links),
    created: today(),
    due: input.due?.trim() || undefined,
    repeat: input.repeat,
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    sourceFile: '',
    sourceLine: 0,
  };

  // A rule alone doesn't place the task on any day — seed the first occurrence
  // so a new recurring task actually shows up somewhere.
  const seeded = withSeededDue(task);

  await appendTaskBlock(store.ws, client, serializeTask(seeded, client.id));
  await store.rebuild('addTask');
  return seeded;
}

/** Add a client to config.json, create an empty client file, and rebuild. */
export async function createClient(store: Store, input: NewClientInput): Promise<Client> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('A client name is required.');
  }
  const id = (input.id?.trim() || slugifyClientId(name));
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error('Client id must be lowercase letters, numbers and dashes.');
  }
  if (id === GENERAL_TODO_CLIENT_ID) {
    throw new Error(`"${GENERAL_TODO_CLIENT_ID}" is reserved for general to-dos.`);
  }
  if (store.db.getClients().some((c) => c.id === id)) {
    throw new Error(`A client with id "${id}" already exists.`);
  }

  const color = input.color?.trim() || undefined;
  const description = input.description?.trim() || undefined;
  const links = parseClientLinks(input.links);
  const config = await store.ws.loadConfig();
  config.clients.push({ id, name, color, description, links });
  await store.ws.saveConfig(config);

  await ensureDir(store.ws.clientsDir);
  const uri = store.ws.clientFile(id);
  if ((await readText(uri)) === undefined) {
    await writeText(uri, `# ${name}\n`);
  }

  await store.rebuild('addClient');
  return { id, name, color, description, links };
}

/** Edit a client's display name, accent color, notes and/or reference links in
 *  config.json, then rebuild. Only the fields passed are touched, and the client
 *  id (and therefore its files/ledger references) is left unchanged. */
export async function updateClient(store: Store, id: string, fields: ClientFields): Promise<Client> {
  const config = await store.ws.loadConfig();
  const client = config.clients.find((c) => c.id === id);
  if (!client) {
    throw new Error(`Unknown client "${id}".`);
  }
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (!name) {
      throw new Error('A client name is required.');
    }
    client.name = name;
  }
  if (fields.color !== undefined) {
    client.color = fields.color.trim() || undefined;
  }
  if (fields.description !== undefined) {
    client.description = fields.description.trim() || undefined;
  }
  if (fields.links !== undefined) {
    client.links = parseClientLinks(fields.links);
  }
  await store.ws.saveConfig(config);
  await store.rebuild('updateClient');
  return {
    id,
    name: client.name,
    color: client.color,
    description: client.description,
    links: client.links,
    archived: client.archived,
  };
}

/** Retire a client (or bring it back) by flipping `archived` in config.json. No
 *  files move: its tasks, archive and ledger entries stay exactly where they are,
 *  so past months keep reporting correctly — the client just drops out of the
 *  pickers and lists you work in day to day. */
export async function setClientArchived(store: Store, id: string, archived: boolean): Promise<void> {
  const config = await store.ws.loadConfig();
  const client = config.clients.find((c) => c.id === id);
  if (!client) {
    throw new Error(`Unknown client "${id}".`);
  }
  client.archived = archived ? true : undefined;
  await store.ws.saveConfig(config);
  await store.rebuild(archived ? 'archiveClient' : 'restoreClient');
}

/** How much history a client carries — what makes deleting it destructive. */
export function clientUsage(store: Store, id: string): { tasks: number; worklog: number } {
  return {
    tasks: store.db.getAllTasks().filter((t) => t.clientIds.includes(id)).length,
    worklog: store.db.getAllWorklog().filter((w) => w.clientId === id).length,
  };
}

/** Delete a client that carries no history: drop it from config.json and remove
 *  its (taskless) client file and archive folder. A client with tasks or logged
 *  time is refused — deleting it would orphan billing history, and the indexer
 *  would resurrect it anyway from the entries that still reference the id.
 *  {@link setClientArchived} is the way to retire those. */
export async function deleteClient(store: Store, id: string): Promise<void> {
  const config = await store.ws.loadConfig();
  const index = config.clients.findIndex((c) => c.id === id);
  if (index < 0) {
    throw new Error(`Unknown client "${id}".`);
  }
  const name = config.clients[index].name;
  const { tasks, worklog } = clientUsage(store, id);
  if (tasks > 0 || worklog > 0) {
    throw new Error(
      `"${name}" still has ${tasks} task${tasks === 1 ? '' : 's'} and ${worklog} time ` +
        `entr${worklog === 1 ? 'y' : 'ies'}. Archive it instead of deleting it.`,
    );
  }

  config.clients.splice(index, 1);
  await store.ws.saveConfig(config);

  // The client file and any archive months left behind are empty by definition
  // (the guard above proved no task parses out of them), so they go with it.
  const archivePrefix = `${store.ws.archiveDir}/${id}/`;
  for (const path of listTextPaths()) {
    if (path === store.ws.clientFile(id) || path.startsWith(archivePrefix)) {
      await deleteFile(path);
    }
  }

  await store.rebuild('deleteClient');
}
