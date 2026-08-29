// Full rebuild: walk the in-memory file map -> parse -> load the db. Iterates the
// mounted FileMap rather than globbing a disk.

import { MemoryDb } from '../db/memoryDb';
import { parseTaskFile } from '../parser/taskParser';
import { parseWorklogFile } from '../parser/worklogParser';
import { parseDayNotesFile } from '../parser/dayNotes';
import { parseChecklistFile } from '../parser/checklistParser';
import { Workspace, fileMap, stem, dirName } from './paths';
import type { Client, DayNote, Task, WorklogEntry } from '../model/types';
import type { Checklist } from '../model/checklist';
import { isEventWorklogClientId } from '../model/worklog';
import { withSeededDue } from '../model/recurringTask';

export interface RebuildResult {
  clients: number;
  tasks: number;
  worklog: number;
  dayNotes: number;
  checklists: number;
}

export async function rebuild(db: MemoryDb, ws: Workspace): Promise<RebuildResult> {
  const config = await ws.loadConfig();
  const fm = fileMap();

  const tasks: Task[] = [];
  const worklog: WorklogEntry[] = [];
  const dayNotes: DayNote[] = [];
  const checklists: Checklist[] = [];

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
    // Day notes: notes/<YYYY-MM>.md
    if (/^notes\/[^/]+\.md$/.test(path)) {
      dayNotes.push(...parseDayNotesFile(text, path));
      continue;
    }
    // Reusable checklists: lists/<id>.md (filename stem is the list id).
    if (/^lists\/[^/]+\.md$/.test(path)) {
      checklists.push(parseChecklistFile(text, path, stem(path)));
      continue;
    }
  }

  // A recurring task with no due date has no day to appear on. Seed it here so
  // the invariant holds for files written before it existed, or by hand.
  const seeded = tasks.map((t) => withSeededDue(t));
  const clients = mergeClients(config.clients, seeded, worklog);

  db.reset();
  // Day notes belong to no client, so they are deliberately not fed to
  // `mergeClients` — a note must never conjure a client into the pickers.
  // Checklists belong to no client either, and for a stronger reason than a day
  // note: a list is not work at all, so it must never reach billing.
  db.load({ clients, tasks: seeded, worklog, dayNotes, checklists });

  return {
    clients: clients.length,
    tasks: seeded.length,
    worklog: worklog.length,
    dayNotes: dayNotes.length,
    checklists: checklists.length,
  };
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
