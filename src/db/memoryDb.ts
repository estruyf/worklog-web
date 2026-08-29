// In-memory query cache. The dataset is tiny (one person's timesheet), so plain
// arrays + maps are more than fast enough and keep the app free of a WASM SQLite
// dependency. Markdown remains the single source of truth: a rebuild re-parses
// the file map and calls {@link load}. Exposes exactly the query surface the
// services, snapshot builder, and views consume.

import type { Client, DayNote, Task, WorklogEntry } from '../model/types';
import type { Checklist } from '../model/checklist';

export class MemoryDb {
  private clients: Client[] = [];
  private tasks: Task[] = [];
  private worklog: WorklogEntry[] = [];
  private dayNotes: DayNote[] = [];
  private checklists: Checklist[] = [];
  private tasksById = new Map<string, Task>();
  private notesByDate = new Map<string, DayNote>();

  /** Replace all cached records (called by the indexer after a full parse). */
  load(data: {
    clients: Client[];
    tasks: Task[];
    worklog: WorklogEntry[];
    dayNotes: DayNote[];
    checklists: Checklist[];
  }): void {
    this.clients = [...data.clients].sort((a, b) => a.name.localeCompare(b.name));
    this.tasks = data.tasks.filter((t) => t.id);
    this.worklog = data.worklog;
    this.dayNotes = data.dayNotes;
    this.checklists = data.checklists;
    this.tasksById = new Map(this.tasks.map((t) => [t.id, t]));
    this.notesByDate = new Map(this.dayNotes.map((n) => [n.date, n]));
  }

  reset(): void {
    this.load({ clients: [], tasks: [], worklog: [], dayNotes: [], checklists: [] });
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

  /** Archived occurrences of a recurring task, most recently completed first. */
  occurrencesOf(templateId: string): Task[] {
    return this.tasks
      .filter((t) => t.repeatOf === templateId)
      .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? ''));
  }

  /** Every task (open + done) — used to build the app state. */
  getAllTasks(): Task[] {
    return [...this.tasks].sort(byCreatedThenTitle);
  }

  /** Every worklog entry — used to build the app state. */
  getAllWorklog(): WorklogEntry[] {
    return [...this.worklog].sort((a, b) => a.date.localeCompare(b.date) || a.clientId.localeCompare(b.clientId));
  }

  /** The note for one day, if it has one. */
  getDayNote(date: string): DayNote | undefined {
    return this.notesByDate.get(date);
  }

  /** Every day note, oldest first — used to build the app state. */
  getAllDayNotes(): DayNote[] {
    return [...this.dayNotes].sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Every checklist, by name — the order they are offered in. */
  getAllChecklists(): Checklist[] {
    return [...this.checklists].sort((a, b) => a.name.localeCompare(b.name));
  }
}

function byCreatedThenTitle(a: Task, b: Task): number {
  return (a.created ?? '').localeCompare(b.created ?? '') || a.title.localeCompare(b.title);
}
