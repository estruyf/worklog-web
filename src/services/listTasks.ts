// The open tasks an agent asks about — "what's due this week?", "what's on my
// to-do list?" — behind the CLI's read-only `list` command. Read from the parsed
// store rather than grepped out of the Markdown, so descriptions, subtasks and
// archived tasks can't be mistaken for open ones.

import { Store } from '../store';
import type { Task } from '../model/types';
import { priorityRank } from '../model/priority';

export interface TaskFilter {
  clientId?: string;
  /** Only tasks due on or before this YYYY-MM-DD; undated tasks drop out. */
  dueBy?: string;
  tag?: string;
}

/** Open tasks matching the filter: dated ones first by due date, then by
 *  priority, then oldest first. */
export function listTasks(store: Store, filter: TaskFilter = {}): Task[] {
  const tag = filter.tag?.trim().toLowerCase();
  return store.db
    .getAllTasks()
    .filter((t) => !t.completed)
    .filter((t) => !filter.clientId || t.clientIds.includes(filter.clientId))
    .filter((t) => !filter.dueBy || (!!t.due && t.due <= filter.dueBy))
    .filter((t) => !tag || (t.tags ?? []).some((x) => x.toLowerCase() === tag))
    .sort(
      (a, b) =>
        (a.due ?? '￿').localeCompare(b.due ?? '￿') ||
        priorityRank(a.priority) - priorityRank(b.priority) ||
        (a.created ?? '').localeCompare(b.created ?? ''),
    );
}
