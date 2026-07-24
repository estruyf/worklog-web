// The app-wide data contract. `WorklogState` is the whole dataset the store
// derives from the parsed Markdown and exposes to the UI; at this tool's scale it
// is small, so the UI holds everything and derives Today / reporting / search /
// insights client-side — no per-view round trips. Kept DOM- and dependency-free.

import type { AutoSyncConfig, Client, StatusDef, Task, WorklogEntry } from "../model/types";

/**
 * The full app state, re-derived on every edit and read by the UI through the
 * store. Immutable between changes (see `worklogStore.getState`).
 */
export interface WorklogState {
  today: string; // local YYYY-MM-DD, computed at derive time
  hoursPerDay: number;
  weekStart: number; // first weekday of the calendar grid: 0 = Sunday … 6 = Saturday
  autoSync: AutoSyncConfig; // background Git-sync behaviour after logging time
  assetsBase: string; // base URL for resolving image refs in Markdown

  statuses: StatusDef[];
  clients: Client[];
  tasks: Task[]; // all tasks (open + done)
  worklog: WorklogEntry[]; // all ledger entries
}
