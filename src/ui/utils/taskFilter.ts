// Pure narrowing + ordering for the open-task lists (Clients, To-dos, the day's
// worked tasks). One place decides what "matches" and what "sorted" mean, so the
// three lists can't drift apart. Kept free of React/DOM so the rules are
// unit-testable, like the search and archive derivations next to it.

import type { Task } from '../../model/types';
import { clientIdOf } from './task';

/** How a list is ordered. `created` is the default: oldest first, which is the
 *  order the work actually arrived in. */
export type TaskSortKey = 'created' | 'due' | 'title' | 'status';

export type TaskSortDirection = 'asc' | 'desc';

/** The sort options in the order the picker offers them. */
export const TASK_SORTS: { key: TaskSortKey; label: string }[] = [
  { key: 'created', label: 'Created' },
  { key: 'due', label: 'Due date' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
];

export interface TaskListFilters {
  /** Free text, matched against title, description, tags, links, id and client name. */
  query: string;
  /** Tags a task must carry — all of them. Empty means no tag filter. */
  tags: string[];
  /** A single status id, or '' for every status. */
  status: string;
  sort: TaskSortKey;
  dir: TaskSortDirection;
}

export const DEFAULT_TASK_LIST_FILTERS: TaskListFilters = {
  query: '',
  tags: [],
  status: '',
  sort: 'created',
  dir: 'asc',
};

/** The read-model helpers the derivation needs, injected so it stays pure. */
export interface TaskListDeps {
  clientName: (id: string) => string;
  /** Configured status ids in display order — what "sort by status" sorts by. */
  statusOrder: string[];
}

export interface TaskTagCount {
  tag: string;
  count: number;
  selected: boolean;
}

export interface TaskListDerived {
  /** The tasks to render: filtered, then ordered. */
  tasks: Task[];
  /** The list before any filter — the denominator in "3 of 12". */
  total: number;
  count: number;
  /** True when a query/tag/status filter is hiding something. Sort is not a
   *  filter, so re-ordering alone never sets this. */
  filtered: boolean;
  /** True when anything at all deviates from the defaults, sort included — what
   *  the Reset affordance keys on. */
  dirty: boolean;
  /** Tags carried by the tasks still visible, most-used first. Counts are what
   *  picking that tag *would* leave, so a chip never promises an empty list.
   *  Selected tags stay listed even once they've narrowed everything away. */
  tagCounts: TaskTagCount[];
  /** Per-status match counts with every filter *except* the status one applied,
   *  so the picker can show what each option would yield. */
  statusCounts: Record<string, number>;
}

/** Whether `q` (already trimmed + lower-cased) occurs anywhere a human would
 *  expect to find a task by. Shared with the Archive filter. */
export function matchesTaskQuery(t: Task, q: string, clientName: string): boolean {
  if (!q) {
    return true;
  }
  return (
    t.title.toLowerCase().includes(q) ||
    (t.description ?? '').toLowerCase().includes(q) ||
    (t.tags ?? []).join(' ').toLowerCase().includes(q) ||
    t.links.some((l) => l.url.toLowerCase().includes(q)) ||
    t.id.toLowerCase().includes(q) ||
    clientName.toLowerCase().includes(q)
  );
}

/** Tags narrow conjunctively: every picked tag must be present. */
function hasEveryTag(t: Task, tags: string[]): boolean {
  if (tags.length === 0) {
    return true;
  }
  const own = (t.tags ?? []).map((tag) => tag.toLowerCase());
  return tags.every((tag) => own.includes(tag));
}

/** Comparator for one sort key. The direction applies to the compared value
 *  only; ties fall through to an ascending title so the order stays total —
 *  otherwise a re-render could shuffle equal rows past each other.
 *
 *  A task missing the date being sorted on goes last in *both* directions: the
 *  absence of a value is not an extreme value, and flipping the arrow to surface
 *  a wall of dateless rows is never what was asked for. `created` is optional on
 *  a hand-written task — the app stamps it, a person editing the Markdown may
 *  not — so the default order has to answer for that too. */
function compare(
  a: Task,
  b: Task,
  sort: TaskSortKey,
  dir: TaskSortDirection,
  statusRank: (id: string) => number,
): number {
  const sign = dir === 'desc' ? -1 : 1;
  switch (sort) {
    case 'created': {
      if (!a.created || !b.created) {
        return a.created ? -1 : b.created ? 1 : a.title.localeCompare(b.title);
      }
      return sign * a.created.localeCompare(b.created) || a.title.localeCompare(b.title);
    }
    case 'due': {
      if (!a.due || !b.due) {
        return a.due ? -1 : b.due ? 1 : a.title.localeCompare(b.title);
      }
      return sign * a.due.localeCompare(b.due) || a.title.localeCompare(b.title);
    }
    case 'title':
      return sign * a.title.localeCompare(b.title);
    case 'status':
      return sign * (statusRank(a.status) - statusRank(b.status)) || a.title.localeCompare(b.title);
    default:
      return 0;
  }
}

/** Filter, then order. `tasks` is never mutated — the caller's array is the
 *  store's, and sorting it in place would reorder the snapshot itself. */
export function deriveTaskList(tasks: Task[], filters: TaskListFilters, deps: TaskListDeps): TaskListDerived {
  const { clientName, statusOrder } = deps;
  const q = filters.query.trim().toLowerCase();
  const tags = filters.tags.map((t) => t.toLowerCase());
  const filtered = q !== '' || tags.length > 0 || filters.status !== '';
  const dirty =
    filtered ||
    filters.sort !== DEFAULT_TASK_LIST_FILTERS.sort ||
    filters.dir !== DEFAULT_TASK_LIST_FILTERS.dir;

  // Query + tags only: these counts drive the status picker, so they must not be
  // narrowed by the status selection itself.
  const facetMatched = tasks.filter((t) => matchesTaskQuery(t, q, clientName(clientIdOf(t))) && hasEveryTag(t, tags));

  const statusCounts: Record<string, number> = {};
  for (const t of facetMatched) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }

  const matched = facetMatched.filter((t) => !filters.status || t.status === filters.status);

  // Counted over what survived every filter, so an unselected chip's number is
  // exactly the list it would leave behind.
  const counts = new Map<string, number>();
  for (const t of matched) {
    for (const tag of t.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  for (const tag of filters.tags) {
    if (![...counts.keys()].some((k) => k.toLowerCase() === tag.toLowerCase())) {
      counts.set(tag, 0);
    }
  }
  const selected = new Set(tags);
  const tagCounts: TaskTagCount[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count, selected: selected.has(tag.toLowerCase()) }));

  const ranks = new Map(statusOrder.map((id, i) => [id, i]));
  const statusRank = (id: string) => ranks.get(id) ?? statusOrder.length;
  const sorted = [...matched].sort((a, b) => compare(a, b, filters.sort, filters.dir, statusRank));

  return {
    tasks: sorted,
    total: tasks.length,
    count: sorted.length,
    filtered,
    dirty,
    tagCounts,
    statusCounts,
  };
}
