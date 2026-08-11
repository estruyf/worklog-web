// How an open-task list is ordered, and the normalization every reader relies on.
//
// This lives in `model/` rather than next to the sorting itself in
// `ui/utils/taskFilter` because the *preference* is persisted: `.worklog/config.json`
// carries it, so `workspace/paths` and `services/settings` have to validate it,
// and neither may import the UI. The comparison functions stay in the UI layer —
// only the vocabulary is shared.

/** How a list is ordered. `created` is the shipped default: the order the work
 *  actually arrived in. Priority stays an explicit choice rather than a tiebreak
 *  folded into the others — it would silently re-order every list in the app for
 *  someone who has never set a priority. */
export type TaskSortKey = 'created' | 'due' | 'title' | 'status' | 'priority';

export type TaskSortDirection = 'asc' | 'desc';

/** The order the picker offers, and the list `normalizeTaskSort` validates against. */
export const TASK_SORT_KEYS: TaskSortKey[] = ['created', 'due', 'priority', 'title', 'status'];

/** The user's default order for open-task lists, stored in config.json. */
export interface TaskSortPref {
  key: TaskSortKey;
  dir: TaskSortDirection;
}

/** What a repo that has never set one is read as — the behaviour this app
 *  shipped with, so an existing timesheet doesn't re-order on upgrade. */
export const DEFAULT_TASK_SORT: TaskSortPref = { key: 'created', dir: 'asc' };

/** A hand-edited or newer-version value reduced to something every reader can
 *  use. Unknown keys fall back rather than throwing: an unreadable sort must not
 *  be able to stop the rest of the config from loading. */
export function normalizeTaskSort(value: unknown): TaskSortPref {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_TASK_SORT };
  }
  const candidate = value as Partial<TaskSortPref>;
  return {
    key: TASK_SORT_KEYS.includes(candidate.key as TaskSortKey) ? (candidate.key as TaskSortKey) : DEFAULT_TASK_SORT.key,
    dir: candidate.dir === 'desc' ? 'desc' : 'asc',
  };
}

export function sameTaskSort(a: TaskSortPref, b: TaskSortPref): boolean {
  return a.key === b.key && a.dir === b.dir;
}
