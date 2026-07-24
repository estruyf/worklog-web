// Shared message + snapshot contracts between the extension host and the React
// webview. Must stay DOM-free and dependency-free so both build targets compile it.

import type { Client, StatusDef, Task, WorklogEntry } from "../model/types";

export type AppTab = "day" | "clients" | "calendar" | "search" | "insights";

/**
 * Boot config injected into the webview HTML as `window.__WORKLOG_INIT__`.
 * `app` renders the full dashboard; `task` renders a single task's detail as a
 * standalone editor tab (see views/taskWindow.ts).
 */
export interface WebviewInit {
  mode: "app" | "task";
  taskId?: string;
}

/**
 * The full app state, pushed on every cache change. At this tool's scale the
 * whole dataset is small, so the webview holds everything and derives Today /
 * reporting / search / insights client-side — no per-view round trips.
 */
export interface Snapshot {
  today: string; // local YYYY-MM-DD, computed host-side
  hoursPerDay: number;
  weekStart: number; // first weekday of the calendar grid: 0 = Sunday … 6 = Saturday
  assetsBase: string; // webview URI of the `assets/` dir, for resolving image refs

  statuses: StatusDef[];
  clients: Client[];
  tasks: Task[]; // all tasks (open + done)
  worklog: WorklogEntry[]; // all ledger entries
}

// Host -> webview
export type HostMessage =
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "gitStatus"; pendingChanges: boolean }
  | { type: "navigate"; tab: AppTab; clientId?: string }
  | { type: "openAddTask"; clientId?: string }
  | { type: "actionError"; message: string }
  | { type: "actionDone"; message: string }
  // Reply to a `saveImage`, correlated by requestId. `ref` is the markdown
  // reference to insert (e.g. "assets/img-….png"); `error` is set on failure.
  | { type: "imageSaved"; requestId: string; ref?: string; error?: string }
  // Loading state is reported to the webview so it can show a spinner while the extension host is
  // still initializing the store and sending the first snapshot. The webview
  // shows a spinner until it receives the first snapshot, so this is only used
  // to show a spinner if the extension host is still starting up.
  | { type: "loading"; loading: boolean };

// Webview -> host
export type WebviewMessage =
  | { type: "ready" }
  | { type: "gitSync" }
  | { type: "logDay" }
  | { type: "reloadWebview" }
  | {
      type: "createTask";
      title: string;
      clientId: string;
      parentId?: string;
      links?: string[];
      description?: string;
      due?: string;
      tags?: string[];
    }
  | {
      type: "updateTask";
      taskId: string;
      title?: string;
      clientId?: string;
      parentId?: string;
      links?: string[];
      description?: string;
      due?: string;
      tags?: string[];
    }
  | { type: "createClient"; name: string; color?: string }
  | { type: "updateClient"; id: string; name?: string; color?: string }
  | { type: "closeTask"; taskId: string; date?: string }
  | { type: "setCompletedDate"; taskId: string; date: string }
  | { type: "toggleWorked"; taskId: string; date: string }
  | { type: "setStatus"; taskId: string; statusId: string }
  | { type: "setParent"; taskId: string; parentId?: string }
  | { type: "createParent"; childId: string; title: string }
  | { type: "deleteTask"; taskId: string }
  // Append a timestamped progress note; the host stamps the time.
  | { type: "addNote"; taskId: string; text: string }
  // Remove a note by its 0-based index in the task's chronological notes list.
  | { type: "deleteNote"; taskId: string; index: number }
  | {
      type: "setWorklog";
      date: string;
      clientId: string;
      hours: number;
      note?: string;
    }
  | {
      type: "setEventWorklog";
      date: string;
      eventType: string;
      hours: number;
      note?: string;
    }
  | { type: "removeWorklog"; date: string; clientId: string }
  | { type: "openSource"; taskId: string }
  | { type: "openTaskWindow"; taskId: string }
  | { type: "openLink"; url: string }
  // Save a pasted/dropped/picked image; the host replies with `imageSaved`.
  | { type: "saveImage"; requestId: string; dataBase64: string; ext: string };
