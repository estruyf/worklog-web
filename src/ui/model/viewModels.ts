// View-model types: the shapes the WorklogApp orchestrator builds and hands to
// the presentational views/components. Distinct from the domain records in
// ../../model/types and the app-wide data contract in ../state.

/** The top-level tabs the shell can display. Search is not a view — it opens as
 * an overlay (see SearchOverlay) on top of whichever view is active. */
export type AppView = "day" | "calendar" | "clients" | "insights" | "archive" | "settings";

/** Resolved status display, computed from a StatusDef + completion state. */
export interface StatusMeta {
  label: string;
  color: string;
}

/** Resolve a status id (+ completion) to its display label and color. */
export type StatusMetaFn = (statusId: string, done: boolean) => StatusMeta;

/** A single task rendered by WorklogTaskRow, with its actions pre-bound. */
export interface WorklogRow {
  id: string;
  title: string;
  pad: string;
  statusLabel: string;
  statusColor: string;
  worked: boolean;
  workedTitle: string;
  hasLink: boolean;
  link: string;
  /** Optional due date (YYYY-MM-DD). */
  due?: string;
  /** True when the task has an unmet due date in the past. */
  overdue: boolean;
  /** Freeform labels rendered as chips. */
  tags: string[];
  /** Subtask completion rollup, present only for tasks that have children. */
  progress?: { done: number; total: number };
  onView: () => void;
  onOpenTab: () => void;
  onDone: () => void;
  onWorked: () => void;
  onCycle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** A client bucket of open/worked task rows for the Today and Clients views. */
export interface ClientTaskGroup {
  id: string;
  name: string;
  color: string;
  count: number;
  rows: WorklogRow[];
}

/** A client bucket of archived tasks for the Archive view. */
export interface ArchiveGroup {
  id: string;
  name: string;
  color: string;
  count: number;
  tasks: import("../../model/types").Task[];
}

/** One client's rolled-up hours for the Insights view. */
export interface MonthlyDateEntry {
  date: string;
  label: string;
}

/** One client's rolled-up hours for the Insights view. */
export interface MonthlyRow {
  name: string;
  color: string;
  hours: number;
  days: string;
  dates: MonthlyDateEntry[];
}

/** Which slice of tasks the Search view matches against. */
export type SearchScope = "all" | "open" | "archived";

/** A single search hit, with its title pre-split around the matched substring. */
export interface SearchResult {
  title: string;
  clientName: string;
  color: string;
  statusLabel: string;
  statusColor: string;
  hasLink: boolean;
  link: string;
  tags: string[];
  /** Title split around the first case-insensitive occurrence of the query. */
  pre: string;
  mid: string;
  post: string;
  /** True when the query actually occurs in the title (so `mid` is highlightable). */
  hasMid: boolean;
  /** The description, populated only when the match was in the description, not the title. */
  snippet: string;
  /** Set when the *only* place the query matched was the link or the id. */
  matchBadge: "link" | "id" | "";
  onEdit: () => void;
}

/** Search hits bucketed by client, in render order. */
export interface SearchGroup {
  name: string;
  color: string;
  count: number;
  rows: SearchResult[];
}

/** The "log time" form state, shared between the Today view and its host. */
export interface LogState {
  open: boolean;
  editing: boolean;
  isEvent: boolean;
  eventType: string;
  client: string;
  type: string;
  hours: number | string;
  note: string;
}
