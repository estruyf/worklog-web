// Task/client creation services shared by the webview panel and the palette
// commands. All writes go to markdown; the watcher/rebuild then refreshes views.

import { Store } from '../store';
import type { Client, Task } from '../model/types';
import { newTaskId } from '../parser/ids';
import { serializeTask } from '../parser/taskParser';
import { today } from '../util/date';
import { appendTaskBlock } from '../commands/shared';
import { writeText, readText, ensureDir } from '../workspace/paths';

export interface NewTaskInput {
  title: string;
  clientId: string;
  parentId?: string;
  links?: string[];
  description?: string;
  due?: string;
  tags?: string[];
}

export interface NewClientInput {
  name: string;
  /** Optional explicit id; otherwise derived from the name. */
  id?: string;
  /** Optional accent color (hex), used by the dashboard. */
  color?: string;
}

export interface ClientFields {
  name?: string;
  color?: string;
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
  const client = store.db.getClients().find((c) => c.id === input.clientId);
  if (!client) {
    throw new Error(`Unknown client "${input.clientId}".`);
  }

  const task: Task = {
    id: newTaskId(),
    title,
    description: input.description?.trim() || undefined,
    status: 'open',
    parentId: input.parentId || undefined,
    clientIds: [client.id],
    links: (input.links ?? []).map((url) => url.trim()).filter(Boolean).map((url) => ({ url })),
    created: today(),
    due: input.due?.trim() || undefined,
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    sourceFile: '',
    sourceLine: 0,
  };

  await appendTaskBlock(store.ws, client, serializeTask(task, client.id));
  await store.rebuild('addTask');
  return task;
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
  if (store.db.getClients().some((c) => c.id === id)) {
    throw new Error(`A client with id "${id}" already exists.`);
  }

  const color = input.color?.trim() || undefined;
  const config = await store.ws.loadConfig();
  config.clients.push({ id, name, color });
  await store.ws.saveConfig(config);

  await ensureDir(store.ws.clientsDir);
  const uri = store.ws.clientFile(id);
  if ((await readText(uri)) === undefined) {
    await writeText(uri, `# ${name}\n`);
  }

  await store.rebuild('addClient');
  return { id, name, color };
}

/** Edit a client's display name and/or accent color in config.json, then rebuild.
 *  The client id (and therefore its files/ledger references) is left unchanged. */
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
  await store.ws.saveConfig(config);
  await store.rebuild('updateClient');
  return { id, name: client.name, color: client.color };
}
