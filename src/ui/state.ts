// The app-wide data contract. `WorklogState` is the whole dataset the store
// derives from the parsed Markdown and exposes to the UI; at this tool's scale it
// is small, so the UI holds everything and derives Today / reporting / search /
// insights client-side — no per-view round trips. Kept DOM- and dependency-free.

import type { AiAgent, AutoSyncConfig, Client, CodeTheme, DayNote, FeatureConfig, StatusDef, Task, TaskSortPref, WorklogEntry } from "../model/types";

/**
 * The full app state, re-derived on every edit and read by the UI through the
 * store. Immutable between changes (see `worklogStore.getState`).
 */
export interface WorklogState {
  today: string; // local YYYY-MM-DD, computed at derive time
  hoursPerDay: number;
  weekStart: number; // first weekday of the calendar grid: 0 = Sunday … 6 = Saturday
  todosPerPage: number; // page size of the day view's to-do side list
  defaultTaskSort: TaskSortPref; // the order open-task lists start in
  codeTheme: CodeTheme; // which Demo Time theme paints fenced code blocks
  autoSync: AutoSyncConfig; // background Git-sync behaviour after logging time
  features: FeatureConfig; // the optional task blocks that are switched on
  aiAgents: AiAgent[]; // AI agents a task can be handed to, by id

  statuses: StatusDef[];
  clients: Client[];
  tasks: Task[]; // all tasks (open + done)
  worklog: WorklogEntry[]; // all ledger entries
  dayNotes: DayNote[]; // one freeform Markdown note per day that has one
}
