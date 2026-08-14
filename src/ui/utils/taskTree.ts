// How a flat list of tasks becomes the nested order the task lists render —
// subtasks indented under their parent — and which of those parents the user has
// folded shut. Pure: `useTaskRows` turns each plan into a `WorklogRow`, and
// `useCollapsedTasks` owns where the folded set is actually kept.

import type { Task } from "../../model/types";
import { clientIdOf, isDone } from "./task";

/** The task a parent picker is picking for: the id it must not offer itself as,
 *  the client that bounds the choice, and the parent it already has. */
export interface ParentSubject {
  /** Absent for a task being created, which nothing can be the parent of yet. */
  id?: string | null;
  clientId: string;
  parentId?: string;
}

/** The tasks that may become `subject`'s parent: open, top-level tasks of the
 *  same client, minus the task itself.
 *
 *  Every clause is load-bearing. A parent in another client would put the two
 *  blocks in different files, and the nesting the lists render reads one list at
 *  a time. `!parentId` is what keeps the tree one level deep — and, since a
 *  task's subtasks all carry its id, it is also what stops a task being made a
 *  child of its own child. Closed tasks are in the archive, where nothing nests.
 *
 *  The parent the task already has is kept whatever it looks like now, so a
 *  picker can always show the value it is standing for — a parent that has since
 *  been completed would otherwise leave the control claiming there is none.
 *
 *  Source order, not alphabetical: it is the order these same tasks are already
 *  in on screen. */
export function parentCandidates(tasks: Task[], subject: ParentSubject): Task[] {
  return tasks.filter(
    (t) =>
      t.id !== subject.id &&
      (t.id === subject.parentId ||
        (clientIdOf(t) === subject.clientId && !t.parentId && !isDone(t))),
  );
}

/** Whether the task may be given a parent at all. A task with subtasks of its own
 *  may not: the tree is one level deep, so a grandchild would be rendered at top
 *  level and read as unrelated to the task it hangs off. */
export function canHaveParent(tasks: Task[], taskId?: string | null): boolean {
  return !taskId || !tasks.some((t) => t.parentId === taskId);
}

/** Whether the task may be given subtasks at all — the other half of the same
 *  one-level-deep rule `canHaveParent` enforces, read from the child's side. A
 *  task that already hangs off another may not: offering to add under it would
 *  either be a control that can't work, or a grandchild the lists would render at
 *  top level. */
export function canHaveSubtasks(task: Task): boolean {
  return !task.parentId;
}

/** One line the list will render, before it becomes a row. */
export interface TaskRowPlan {
  task: Task;
  /** Indented under its parent, which is the line directly above it. */
  child: boolean;
  /** The task has subtasks *in this list*, so its row gets a fold toggle. A
   *  parent whose subtasks a filter removed gets none — there is nothing behind
   *  it to fold away. */
  foldable: boolean;
  /** Its subtasks are folded away and absent from the plan. Never true unless
   *  `foldable` is. */
  collapsed: boolean;
}

/** Nested render order for `list`, with the subtasks of every parent in
 *  `collapsed` left out. Subtasks whose parent isn't in `list` stay at top level:
 *  the list is usually a filtered slice, and dropping them would lose them
 *  entirely rather than nest them. */
export function planTaskRows(list: Task[], collapsed: ReadonlySet<string> = new Set()): TaskRowPlan[] {
  const plans: TaskRowPlan[] = [];
  const tops = list.filter((t) => !t.parentId);
  const placed = new Set<string>();

  tops.forEach((t) => {
    const kids = list.filter((c) => c.parentId === t.id);
    const foldable = kids.length > 0;
    const folded = foldable && collapsed.has(t.id);
    plans.push({ task: t, child: false, foldable, collapsed: folded });
    placed.add(t.id);
    if (!folded) {
      kids.forEach((c) => {
        plans.push({ task: c, child: true, foldable: false, collapsed: false });
        placed.add(c.id);
      });
    }
  });

  list
    .filter((t) => t.parentId && !tops.some((p) => p.id === t.parentId))
    .forEach((c) => {
      if (!placed.has(c.id)) {
        plans.push({ task: c, child: false, foldable: false, collapsed: false });
        placed.add(c.id);
      }
    });

  return plans;
}

/** Whether anything in the plan nests, which is what decides if the rows reserve
 *  the fold column at all. Within one list the answer has to be the same for
 *  every row — titles that started at different x depending on their own
 *  subtasks would read as a ragged list — but a list with no parent among it has
 *  nothing to line up with, and indenting every title past a chevron that will
 *  never be drawn is space spent on nothing. */
export function plansFold(plans: TaskRowPlan[]): boolean {
  return plans.some((p) => p.foldable);
}

/** What the detail panel's subtask section renders, given the user's choice of
 *  whether the done ones are on screen. */
export interface SubtaskListModel {
  /** Render order: the open ones, then the done ones when they're shown. */
  visible: Task[];
  doneCount: number;
  /** Done subtasks are on screen — which is not the same as the user asking for
   *  them, see below. */
  showingDone: boolean;
  /** Whether the toggle is worth drawing. */
  canToggle: boolean;
}

/** Splits a task's subtasks into what to show and what the toggle says.
 *
 *  Done last, and hidden until asked for: a subtask list is a list of what is
 *  left to do, and the closed ones are the record. Source order is kept within
 *  each half — it is the order they sit in the Markdown.
 *
 *  A list whose subtasks are *all* done shows them whatever `showDone` says.
 *  Hiding them there would leave a section with a count, a card and no rows,
 *  which reads as broken rather than as tidy. */
export function deriveSubtaskList(subtasks: Task[], showDone: boolean): SubtaskListModel {
  const open = subtasks.filter((t) => !isDone(t));
  const done = subtasks.filter(isDone);
  const showingDone = showDone || open.length === 0;
  return {
    visible: showingDone ? [...open, ...done] : open,
    doneCount: done.length,
    showingDone,
    canToggle: done.length > 0 && open.length > 0,
  };
}

/** Folded parent ids, per repo. Keyed by repo so one repo's folds are never
 *  applied to another's ids, and so pruning ids that no longer exist can only
 *  ever touch the repo that is open. */
export type CollapsedStore = Record<string, string[]>;

/** Reads what was persisted, tolerating anything: this comes back from storage a
 *  user (or an older version of the app) can have written, and it feeds a lookup
 *  the whole task list renders from. */
export function parseCollapsedStore(raw: string | null): CollapsedStore {
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const store: CollapsedStore = {};
  for (const [repoKey, ids] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(ids)) {
      continue;
    }
    const clean = ids.filter((id): id is string => typeof id === "string" && id !== "");
    if (clean.length > 0) {
      store[repoKey] = clean;
    }
  }
  return store;
}

/** Folds `id` if it is open, unfolds it if it is folded. */
export function toggleCollapsed(store: CollapsedStore, repoKey: string, id: string): CollapsedStore {
  const ids = store[repoKey] ?? [];
  return withIds(store, repoKey, ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
}

/** Drops folded ids whose task is gone, so a set that only ever grows can't
 *  outlive the tasks it describes. Returns `store` itself when nothing changed,
 *  so callers can skip a needless write. */
export function pruneCollapsed(store: CollapsedStore, repoKey: string, liveIds: ReadonlySet<string>): CollapsedStore {
  const ids = store[repoKey];
  if (!ids) {
    return store;
  }
  const kept = ids.filter((id) => liveIds.has(id));
  return kept.length === ids.length ? store : withIds(store, repoKey, kept);
}

/** An empty list removes the repo's entry rather than persisting `[]`, so a repo
 *  you have unfolded everything in leaves nothing behind. */
function withIds(store: CollapsedStore, repoKey: string, ids: string[]): CollapsedStore {
  const next = { ...store };
  if (ids.length > 0) {
    next[repoKey] = ids;
  } else {
    delete next[repoKey];
  }
  return next;
}
