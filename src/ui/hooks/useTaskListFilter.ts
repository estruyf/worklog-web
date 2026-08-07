// Session-scoped filter + sort state for one open-task list, plus the props its
// toolbar renders from. Deliberately local: the choice belongs to the list you
// are looking at right now, so it dies with the view and never reaches the
// user's Markdown. The rules themselves live in `ui/utils/taskFilter`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task } from '../../model/types';
import { NORMAL_PRIORITY_ID, PRIORITIES } from '../../model/priority';
import type { TaskListToolbarProps, TaskStatusOption } from '../components/TaskListToolbar';
import { useData } from '../context';
import { DEFAULT_TASK_LIST_FILTERS, deriveTaskList, type TaskListFilters, type TaskSortKey } from '../utils';

export interface TaskListFilterOptions {
  /** Names the controls for screen readers — "open tasks", "to-dos". */
  label?: string;
  /** Off for lists whose status carries no information (general to-dos are open
   *  or closed only), which drops the status control entirely. */
  withStatus?: boolean;
  /** Changing this clears the filters: the Clients view swaps the whole list
   *  under the toolbar when another client is picked, and a query left over from
   *  the previous one reads as "this client has no tasks". */
  resetKey?: string;
  /** Below this many tasks the toolbar is noise, so it stays hidden — unless a
   *  filter is already on, which is exactly how the list got short. */
  minItems?: number;
}

export interface TaskListFilterApi {
  /** The tasks to render: narrowed, then ordered. */
  tasks: Task[];
  count: number;
  total: number;
  /** True when a filter is hiding rows — what an empty list should explain. */
  filtered: boolean;
  reset: () => void;
  /** Props to spread onto `<TaskListToolbar>`, or null when the list is too
   *  short to be worth one. */
  toolbar: TaskListToolbarProps | null;
}

export function useTaskListFilter(tasks: Task[], options: TaskListFilterOptions = {}): TaskListFilterApi {
  const { label = 'tasks', withStatus = true, resetKey, minItems = 2 } = options;
  const { clientName, statuses, statusMeta } = useData();
  const [filters, setFilters] = useState<TaskListFilters>(DEFAULT_TASK_LIST_FILTERS);

  const reset = useCallback(() => setFilters(DEFAULT_TASK_LIST_FILTERS), []);

  useEffect(() => {
    setFilters(DEFAULT_TASK_LIST_FILTERS);
  }, [resetKey]);

  const statusOrder = useMemo(() => statuses.map((s) => s.id), [statuses]);
  const effective = useMemo<TaskListFilters>(
    () => (withStatus ? filters : { ...filters, status: '' }),
    [filters, withStatus],
  );

  const derived = useMemo(
    () => deriveTaskList(tasks, effective, { clientName, statusOrder }),
    [tasks, effective, clientName, statusOrder],
  );

  const setQuery = useCallback((query: string) => setFilters((f) => ({ ...f, query })), []);
  const setStatus = useCallback((status: string) => setFilters((f) => ({ ...f, status })), []);
  const setPriority = useCallback((priority: string) => setFilters((f) => ({ ...f, priority })), []);
  const setSort = useCallback((sort: TaskSortKey) => setFilters((f) => ({ ...f, sort })), []);
  const toggleDir = useCallback(() => setFilters((f) => ({ ...f, dir: f.dir === 'asc' ? 'desc' : 'asc' })), []);
  const toggleTag = useCallback(
    (tag: string) =>
      setFilters((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag] })),
    [],
  );

  // Only statuses actually present in the list are offered — plus whichever one
  // is picked, so a filter that has narrowed itself to nothing can be undone.
  //
  // A status the config no longer lists is offered too, at the end: removing one
  // leaves its tasks where they are, and a list you can see them in but not
  // filter by is the worst of both. `statusMeta` renders those as their raw id.
  const statusOptions = useMemo<TaskStatusOption[] | null>(() => {
    if (!withStatus) {
      return null;
    }
    const configured = new Set(statuses.map((s) => s.id));
    const toOption = (id: string): TaskStatusOption => ({
      id,
      label: statusMeta(id, false).name,
      count: derived.statusCounts[id] ?? 0,
    });
    return [
      ...statuses
        .filter((s) => !s.terminal && ((derived.statusCounts[s.id] ?? 0) > 0 || s.id === filters.status))
        .map((s) => toOption(s.id)),
      ...Object.keys(derived.statusCounts)
        .filter((id) => !configured.has(id))
        .sort()
        .map(toOption),
    ];
  }, [withStatus, statuses, derived.statusCounts, filters.status, statusMeta]);

  // Offered on every list, to-dos included — unlike status, priority says
  // something about a to-do too — but only once something in the list carries
  // one. A list where everything is normal would get a picker whose single option
  // is the list you are already looking at, and the field is opt-in, so that is
  // the common case until it starts being used.
  const priorityOptions = useMemo<TaskStatusOption[] | null>(() => {
    const present = PRIORITIES.filter(
      (p) => (derived.priorityCounts[p.id] ?? 0) > 0 || p.id === filters.priority,
    );
    if (present.every((p) => p.id === NORMAL_PRIORITY_ID)) {
      return null;
    }
    return present.map((p) => ({ id: p.id, label: p.label, count: derived.priorityCounts[p.id] ?? 0 }));
  }, [derived.priorityCounts, filters.priority]);

  const toolbar = useMemo<TaskListToolbarProps | null>(() => {
    if (tasks.length < minItems && !derived.dirty) {
      return null;
    }
    return {
      label,
      query: filters.query,
      onQuery: setQuery,
      status: effective.status,
      onStatus: setStatus,
      statusOptions,
      priority: filters.priority,
      onPriority: setPriority,
      priorityOptions,
      tags: derived.tagCounts,
      onToggleTag: toggleTag,
      sort: filters.sort,
      onSort: setSort,
      dir: filters.dir,
      onToggleDir: toggleDir,
      dirty: derived.dirty,
      onReset: reset,
      filtered: derived.filtered,
      count: derived.count,
      total: derived.total,
    };
  }, [
    tasks.length,
    minItems,
    label,
    filters,
    effective.status,
    statusOptions,
    priorityOptions,
    derived,
    setQuery,
    setStatus,
    setPriority,
    setSort,
    toggleDir,
    toggleTag,
    reset,
  ]);

  return { tasks: derived.tasks, count: derived.count, total: derived.total, filtered: derived.filtered, reset, toolbar };
}
