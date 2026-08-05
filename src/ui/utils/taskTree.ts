// How a flat list of tasks becomes the nested order the task lists render —
// subtasks indented under their parent — and which of those parents the user has
// folded shut. Pure: `useTaskRows` turns each plan into a `WorklogRow`, and
// `useCollapsedTasks` owns where the folded set is actually kept.

import type { Task } from "../../model/types";

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
