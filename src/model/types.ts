// Core data contracts. Markdown is the source of truth; these are the
// structured records the parser produces and the cache stores.

import type { Recurrence } from './recurrence';
import type { AutoSyncEvent } from './syncEvents';
import type { AiAgent } from './aiAgents';
import type { TaskPriority } from './priority';
import type { TaskSortPref } from './taskSort';

export type { Recurrence } from './recurrence';
export type { AutoSyncEvent } from './syncEvents';
export type { AiAgent } from './aiAgents';
export type { TaskPriority } from './priority';
export type { TaskSortPref } from './taskSort';

// Statuses are configurable (see StatusDef / config.json). The type is a plain
// string id; the configured StatusDef list supplies labels, colors and which id
// is "terminal" (closing → archive).
export type TaskStatus = string;

export interface StatusDef {
  id: string;
  label: string;
  /** The terminal/closing status: reaching it archives the task and cascades to children. */
  terminal?: boolean;
  color?: string;
}

/** A single task as parsed from a client or archive markdown file. */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  /** How much this one matters, on the fixed scale in `model/priority.ts`.
   *  Absent *is* the value "normal" — the app writes no line for it — so readers
   *  go through `priorityRank`/`priorityBucket` rather than testing for it. */
  priority?: TaskPriority;
  parentId?: string;
  /** Client ids this task is tagged to. Usually exactly one. */
  clientIds: string[];
  links: TaskLink[];
  /** Files that belong to this task, as repo-relative refs (`assets/<file>`).
   *  The Markdown line is the record; the bytes live beside it in the repo. */
  attachments?: string[];
  created?: string; // YYYY-MM-DD
  /** Optional due date (YYYY-MM-DD); drives overdue highlighting. For a recurring
   *  task this is the next occurrence, and it rolls forward on each completion. */
  due?: string;
  completed?: string; // YYYY-MM-DD
  /** Recurrence rule. The task stays in its client file and its `due` advances
   *  on completion; each completion also leaves a snapshot in the archive. */
  repeat?: Recurrence;
  /** Date this recurring task was last completed (YYYY-MM-DD). */
  lastDone?: string;
  /** On an archived snapshot: the id of the recurring task it came from. */
  repeatOf?: string;
  /** Dates the task was actively worked on (YYYY-MM-DD), independent from completion. */
  workedOn?: string[];
  /** Freeform labels for cross-client grouping/filtering. */
  tags?: string[];
  /** Chronological progress notes/comments, oldest first. */
  notes?: TaskNote[];
  /** Absolute path of the file this task was parsed from (for open-on-click). */
  sourceFile: string;
  /** 0-based line of the `## ` heading in the source file. */
  sourceLine: number;
}

export interface TaskLink {
  url: string;
  label?: string;
}

/** A single timestamped progress note attached to a task. */
export interface TaskNote {
  /** Local timestamp when the note was added, "YYYY-MM-DD HH:mm". */
  timestamp: string;
  /** Note body (Markdown; may span multiple lines). */
  text: string;
}

/** A billing entry: one (date, client) pair with stated hours. */
export interface WorklogEntry {
  date: string; // YYYY-MM-DD
  clientId: string;
  hours: number;
  note?: string;
  sourceFile: string;
  sourceLine: number;
}

/** A day's freeform Markdown note — the half of a day that is neither billed
 *  nor a task. One per date, parsed from `notes/<YYYY-MM>.md`. */
export interface DayNote {
  date: string; // YYYY-MM-DD
  /** The note body (Markdown; usually multi-line). Never empty — an emptied
   *  note is removed from the file rather than stored blank. */
  body: string;
  sourceFile: string;
  /** 0-based line of the `## <date>` heading in the source file. */
  sourceLine: number;
}

export interface Client {
  id: string;
  name: string;
  color?: string;
  /** Freeform Markdown notes about the client — the contact, the agreed rate,
   *  how they like to be invoiced. Shown on the Clients view. */
  description?: string;
  /** Reference links that belong to the client rather than any one task: their
   *  repo, the shared drive, the ticketing board. */
  links?: TaskLink[];
  /** Retired client: hidden from the pickers and lists, but its tasks, archive
   *  and ledger history stay intact and keep resolving to this name/color. */
  archived?: boolean;
}

/** Automatic Git sync after logging time, so a timesheet doesn't sit unpushed. */
export interface AutoSyncConfig {
  /** When on, changes are committed and pushed automatically in the background. */
  enabled: boolean;
  /** Minutes to wait after the last change before syncing; edits coalesce into one. */
  delayMinutes: number;
  /** Change kinds that sync within seconds instead of waiting out `delayMinutes`.
   *  Independent of `enabled`: ticking one is a way to have exactly the changes
   *  that matter pushed promptly without a background timer running at all. */
  events: AutoSyncEvent[];
}

export interface DaylogConfig {
  hoursPerDay: number;
  /** First day of the week for the calendar grid: 0 = Sunday … 6 = Saturday. */
  weekStart: number;
  /** How many open to-dos the day view's side list shows per page. */
  todosPerPage: number;
  /** The order open-task lists start in, and what their Reset returns to. */
  defaultTaskSort: TaskSortPref;
  clients: Client[];
  statuses: StatusDef[];
  autoSync: AutoSyncConfig;
  /** AI agents a task can be handed to, by id — the ones switched on in Settings.
   *  Empty is the shipped state: nothing is offered until it is asked for. */
  aiAgents: AiAgent[];
}
