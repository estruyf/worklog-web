// "I worked on this today", recorded from outside the app — the entry point the
// agent CLI (scripts/log-work.ts) calls on a timesheet clone. It finds the task by
// id, link or title, creates it when none matches, marks the day worked and adds
// the note, all through the same services the app's buttons call.
//
// It has to be idempotent: the CLI replays it on a fresh copy of the branch when
// its push loses a race, so a second run with the same input must change nothing.

import { Store } from '../store';
import type { Task } from '../model/types';
import { addTaskNote, toggleTaskWorkedOn } from './taskOps';
import { createTask } from './tasks';
import { today } from '../util/date';

export interface LogWorkInput {
  clientId: string;
  title: string;
  /** The task's own id, when the caller knows it — wins over link and title. */
  taskId?: string;
  /** The issue/ticket url; the key an agent finds the same task again by. */
  link?: string;
  note?: string;
  /** Defaults to today. */
  date?: string;
}

export interface LogWorkResult {
  task: Task;
  created: boolean;
  markedWorked: boolean;
  noteAdded: boolean;
}

export async function logWork(store: Store, input: LogWorkInput): Promise<LogWorkResult> {
  const date = input.date ?? today();
  let task = findTask(store, input);
  const created = !task;
  if (!task) {
    task = await createTask(store, {
      clientId: input.clientId,
      title: input.title,
      links: input.link ? [input.link] : undefined,
    });
  }

  const markedWorked = !(task.workedOn ?? []).includes(date);
  if (markedWorked) {
    task = await toggleTaskWorkedOn(store, task.id, date);
  }

  // Same text stamped today counts as already written — that is what makes a
  // replay after a lost push a no-op instead of a duplicate note. Today, not
  // `date`: addTaskNote stamps the note with now, whatever day was worked.
  const note = input.note?.trim();
  const noteAdded = !!note && !(task.notes ?? []).some((n) => n.timestamp.startsWith(today()) && n.text === note);
  if (noteAdded) {
    task = await addTaskNote(store, task.id, note);
  }

  return { task: store.db.getTask(task.id) ?? task, created, markedWorked, noteAdded };
}

function findTask(store: Store, input: LogWorkInput): Task | undefined {
  if (input.taskId) {
    const byId = store.db.getTask(input.taskId);
    if (!byId) {
      throw new Error(`Task ${input.taskId} not found.`);
    }
    return byId;
  }
  // Archived tasks are searched too: an issue picked up again after it was closed
  // gets its work logged on the task it already has, not on a duplicate.
  const all = store.db.getAllTasks().filter((t) => t.clientIds.includes(input.clientId));
  const link = input.link ? normalizeUrl(input.link) : undefined;
  const byLink = link ? all.find((t) => t.links.some((l) => normalizeUrl(l.url) === link)) : undefined;
  // A task typed into the app by hand carries no link yet, so an open task of
  // the same title is the same piece of work.
  const title = input.title.trim().toLowerCase();
  return byLink ?? all.find((t) => !t.completed && t.title.trim().toLowerCase() === title);
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}
