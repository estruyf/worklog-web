// View-model types: the shapes the WorklogApp orchestrator builds and hands to
// the presentational views/components. Distinct from the domain records in
// ../../model/types and the app-wide data contract in ../state.

import type { RecurrenceAnchor } from "../../model/recurrence";

/** The top-level tabs the shell can display. Search is not a view — it opens as
 * an overlay (see SearchOverlay) on top of whichever view is active. */
export type AppView =
  | "day"
  | "overdue"
  | "upcoming"
  | "todos"
  | "lists"
  | "calendar"
  | "clients"
  | "insights"
  | "archive"
  | "shortcuts"
  | "settings";

/** One reference link while a form is editing it. `label` is always a string
 *  ('' when unset) so a controlled input never flips to uncontrolled — the model's
 *  `TaskLink.label` is optional, and the blank is dropped on save. The task form
 *  and the client editor share this shape (and `LinksField`, which edits it). */
export interface LinkDraft {
  url: string;
  label: string;
}

/** Everything the task form collects, in the shape the form holds it: raw text as
 *  typed, normalized on submit. `repeat` is the canonical `- repeat:` expression
 *  ('' = one-off) plus its two qualifiers, so the form and the files go through
 *  the same parser. */
export interface TaskFormFields {
  title: string;
  clientId: string;
  /** A priority id; 'normal' is the default and writes no line. */
  priority: string;
  parentId: string;
  links: LinkDraft[];
  due: string;
  repeat: string;
  repeatFrom: RecurrenceAnchor;
  repeatUntil: string;
  tags: string[];
  description: string;
}

/** Resolved status display, computed from a StatusDef + completion state.
 *  `label` is the uppercase form the status column renders; `name` is the status
 *  as configured, for prose and accessible names. */
export interface StatusMeta {
  label: string;
  name: string;
  color: string;
}

/** Resolve a status id (+ completion) to its display label and color. */
export type StatusMetaFn = (statusId: string, done: boolean) => StatusMeta;

/** One configured status as the quick picker offers it, pre-resolved so the
 *  presentational components need no access to the config. */
export interface StatusChoice {
  id: string;
  /** As configured, not the uppercase column form: this is a list you read. */
  name: string;
  color: string;
  /** The closing status: picking it completes and archives the task. */
  terminal: boolean;
}

/** A task's status as a row renders it: how it looks, and what it can become.
 *  Absent on rows whose status carries no information (general to-dos). */
export interface RowStatus {
  id: string;
  label: string;
  name: string;
  color: string;
  done: boolean;
  choices: StatusChoice[];
  onSelect: (statusId: string) => void;
}

/** A single task rendered by WorklogTaskRow, with its actions pre-bound. */
export interface WorklogRow {
  id: string;
  title: string;
  /** A subtask, drawn under its parent. Only the *title cell* indents and takes
   *  the lighter type: the columns beside it belong to the whole list, and a
   *  subtask whose status sat 22px right of every other row's would be a subtask
   *  outside the status column. */
  child: boolean;
  /** The parent's title, for the row's spoken name — the rail and the indent say
   *  nothing out loud. Set exactly when `child` is. */
  parentTitle?: string;
  /** Whether the row leaves room for the fold toggle. A list-level answer, the
   *  same on every row in one list: true once anything in it has subtasks, so the
   *  titles line up whether or not this particular row folds; false in a flat
   *  list, which spends no width on a chevron none of its rows will ever show. */
  foldSlot: boolean;
  /** Status display + the quick picker's data, omitted for rows whose status
   *  carries no information (general to-dos, which are open or closed only). */
  status?: RowStatus;
  /** Worked-on state for the selected day. Always false for rows that don't
   *  track it (general to-dos), where `onWorked` is omitted too. */
  worked: boolean;
  /** The toggle's hover sentence and its short action text — see `workedLabels`. */
  workedTitle: string;
  workedLabel: string;
  hasLink: boolean;
  link: string;
  /** The priority chip's id and label, present only when the task carries a
   *  priority worth showing — normal is the absence of a marker, not a grey one
   *  on every row. */
  priority?: { id: string; label: string };
  /** Optional due date (YYYY-MM-DD). */
  due?: string;
  /** True when the task has an unmet due date in the past. */
  overdue: boolean;
  /** How many days late an overdue row is; omitted when it isn't overdue. */
  overdueDays?: number;
  /** The recurrence rule in words, for tasks that repeat; drives the chip. */
  repeat?: string;
  /** Freeform labels rendered as chips. */
  tags: string[];
  /** Subtask completion rollup, present only for tasks that have children. */
  progress?: { done: number; total: number };
  /** Whether this row's subtasks are folded away. Set only on rows that have
   *  subtasks *in the same list* — `progress` counts every child the task has,
   *  including ones a filter removed, so it can't stand in for this. */
  collapsed?: boolean;
  /** Folds/unfolds the subtasks. Present exactly when `collapsed` is. */
  onToggleCollapse?: () => void;
  /** The ids of the subtask rows this one folds away, so the toggle can name
   *  what it controls. Present exactly when `collapsed` is. */
  childIds?: string[];
  onView: () => void;
  onDone: () => void;
  /** Omitted for tasks without a worked-on state (general to-dos); the row then
   *  hides the worked toggle. */
  onWorked?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Follows a tag chip into the tag-filtered search. Omitted where tags are
   *  shown but not actionable. */
  onTagClick?: (tag: string) => void;
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
  /** Which corpus the hit came from. Neither a day note nor a checklist belongs
   *  to a client or has a status, which is why the four fields below are
   *  optional. */
  kind: "task" | "note" | "list";
  /** The task's title, the day's long-form date, or the checklist item. */
  title: string;
  clientName?: string;
  color?: string;
  statusLabel?: string;
  statusColor?: string;
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

/** The "log time" form state, shared between the Today view and its host.
 *
 *  `editingClientId` is the worklog id the form was opened on ('' for a new
 *  entry): the ledger is keyed by (date, client), so re-pointing an entry at
 *  another client has to remove the line it came from. */
export interface LogState {
  open: boolean;
  editingClientId: string;
  isEvent: boolean;
  eventType: string;
  client: string;
  type: string;
  hours: number | string;
  note: string;
}
