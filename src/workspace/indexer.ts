// Full rebuild: walk the in-memory file map -> parse -> load the db. Mirrors the
// extension's indexer, but iterates the mounted FileMap instead of globbing disk.

import { MemoryDb } from '../db/memoryDb';
import { parseTaskFile } from '../parser/taskParser';
import { parseWorklogFile } from '../parser/worklogParser';
import { Workspace, fileMap, stem, dirName } from './paths';
import { Client, Task, WorklogEntry } from '../model/types';
import { isEventWorklogClientId } from '../model/worklog';

export interface RebuildResult {
  clients: number;
  tasks: number;
  worklog: number;
}

export async function rebuild(db: MemoryDb, ws: Workspace): Promise<RebuildResult> {
  const config = await ws.loadConfig();
  const fm = fileMap();

  const tasks: Task[] = [];
  const worklog: WorklogEntry[] = [];

  for (const [path, text] of fm.text) {
    // Open tasks: clients/<id>.md (filename stem is the canonical client id).
    if (/^clients\/[^/]+\.md$/.test(path)) {
      tasks.push(...parseTaskFile(text, path, stem(path)).tasks);
      continue;
    }
    // Completed tasks: archive/<client>/<YYYY-MM>.md
    if (/^archive\/[^/]+\/[^/]+\.md$/.test(path)) {
      tasks.push(...parseTaskFile(text, path, dirName(path)).tasks);
      continue;
    }
    // Worklog ledger: worklog/<YYYY-MM>.md
    if (/^worklog\/[^/]+\.md$/.test(path)) {
      worklog.push(...parseWorklogFile(text, path));
      continue;
    }
  }

  const clients = mergeClients(config.clients, tasks, worklog);

  db.reset();
  db.load({ clients, tasks, worklog });

  return { clients: clients.length, tasks: tasks.length, worklog: worklog.length };
}

/** Clients come from config; also synthesise any referenced-but-unconfigured
 *  client id so tasks/worklog never dangle against a missing client in the view. */
function mergeClients(configured: Client[], tasks: Task[], worklog: WorklogEntry[]): Client[] {
  const byId = new Map<string, Client>();
  for (const c of configured) {
    byId.set(c.id, c);
  }
  const ensure = (id: string) => {
    if (id && !byId.has(id)) {
      byId.set(id, { id, name: id });
    }
  };
  for (const t of tasks) {
    t.clientIds.forEach(ensure);
  }
  for (const w of worklog) {
    if (!isEventWorklogClientId(w.clientId)) {
      ensure(w.clientId);
    }
  }
  return [...byId.values()];
}
