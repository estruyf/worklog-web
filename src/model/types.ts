// Core data contracts. Markdown is the source of truth; these are the
// structured records the parser produces and the cache stores.

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
  parentId?: string;
  /** Client ids this task is tagged to. Usually exactly one. */
  clientIds: string[];
  links: TaskLink[];
  created?: string; // YYYY-MM-DD
  /** Optional due date (YYYY-MM-DD); drives overdue highlighting. */
  due?: string;
  completed?: string; // YYYY-MM-DD
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

export interface Client {
  id: string;
  name: string;
  color?: string;
}

/** Automatic Git sync after logging time, so a timesheet doesn't sit unpushed. */
export interface AutoSyncConfig {
  /** When on, changes are committed and pushed automatically in the background. */
  enabled: boolean;
  /** Minutes to wait after the last change before syncing; edits coalesce into one. */
  delayMinutes: number;
}

export interface DaylogConfig {
  hoursPerDay: number;
  /** First day of the week for the calendar grid: 0 = Sunday … 6 = Saturday. */
  weekStart: number;
  clients: Client[];
  statuses: StatusDef[];
  autoSync: AutoSyncConfig;
}
