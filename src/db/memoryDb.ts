// In-memory query cache. The dataset is tiny (one person's timesheet), so plain
// arrays + maps are more than fast enough and keep the app free of a WASM SQLite
// dependency. Markdown remains the single source of truth: a rebuild re-parses
// the file map and calls {@link load}. Exposes exactly the query surface the
// services, snapshot builder, and views consume.

import type { Client, Task, WorklogEntry } from '../model/types';

export class MemoryDb {
  private clients: Client[] = [];
  private tasks: Task[] = [];
  private worklog: WorklogEntry[] = [];
  private tasksById = new Map<string, Task>();

  /** Replace all cached records (called by the indexer after a full parse). */
  load(data: { clients: Client[]; tasks: Task[]; worklog: WorklogEntry[] }): void {
    this.clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name));
    this.tasks = data.tasks.filter((t) => t.id);
    this.worklog = data.worklog;
    this.tasksById = new Map(this.tasks.map((t) => [t.id, t]));
  }

  reset(): void {
    this.load({ clients: [], tasks: [], worklog: [] });
  }

  getClients(): Client[] {
    return this.clients;
  }

  getTask(id: string): Task | undefined {
    return this.tasksById.get(id);
  }

  /** Direct children of a task. */
  getChildren(parentId: string): Task[] {
    return this.tasks
      .filter((t) => t.parentId === parentId)
      .sort(byCreatedThenTitle);
  }

  /** Active (not-yet-closed) tasks for a client — closed once it has a completed date. */
  openTasksForClient(clientId: string): Task[] {
    return this.tasks
      .filter((t) => t.clientIds.includes(clientId) && !t.completed)
      .sort(byCreatedThenTitle);
  }

  /** Every task (open + done) — used to build the app state. */
  getAllTasks(): Task[] {
    return [...this.tasks].sort(byCreatedThenTitle);
  }

  /** Every worklog entry — used to build the app state. */
  getAllWorklog(): WorklogEntry[] {
    return [...this.worklog].sort((a, b) => a.date.localeCompare(b.date) || a.clientId.localeCompare(b.clientId));
  }
}

function byCreatedThenTitle(a: Task, b: Task): number {
  return (a.created ?? '').localeCompare(b.created ?? '') || a.title.localeCompare(b.title);
}
