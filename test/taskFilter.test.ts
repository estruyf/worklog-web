// Unit tests for the open-task lists' pure filter/sort derivation.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_LIST_FILTERS,
  deriveTaskList,
  matchesTaskQuery,
  taskListFiltersFor,
  type TaskListFilters,
} from '../src/ui/utils/taskFilter';
import type { Task } from '../src/model/types';

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.id,
    status: 'open',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'clients/acme.md',
    sourceLine: 0,
    ...over,
  };
}

const deps = {
  clientName: (id: string) => (id === 'acme' ? 'Acme Corp' : 'Globex'),
  statusOrder: ['open', 'progress', 'blocked', 'done'],
};

const filters = (over: Partial<TaskListFilters> = {}): TaskListFilters => ({
  ...DEFAULT_TASK_LIST_FILTERS,
  ...over,
});

// Deliberately in no order any sort key would produce, so every sort has to
// visibly disagree with the order they are written in.
const tasks: Task[] = [
  task({
    id: 'charlie',
    title: 'Charlie',
    created: '2026-07-02',
    due: '2026-08-10',
    status: 'blocked',
    priority: 'low',
    tags: ['bug'],
  }),
  task({
    id: 'alpha',
    title: 'Alpha',
    created: '2026-07-20',
    due: '2026-08-01',
    status: 'progress',
    priority: 'urgent',
    tags: ['bug', 'billing'],
  }),
  task({ id: 'bravo', title: 'Bravo', created: '2026-06-11', status: 'open', description: 'invoice follow-up' }),
  task({
    id: 'delta',
    title: 'Delta',
    created: '2026-07-20',
    due: '2026-07-04',
    status: 'open',
    clientIds: ['globex'],
    tags: ['billing'],
  }),
];

const ids = (d: { tasks: Task[] }) => d.tasks.map((t) => t.id);

describe('matchesTaskQuery', () => {
  it('looks in title, description, tags, links, id and client name', () => {
    const t = task({
      id: 'task-1',
      title: 'Ship it',
      description: 'the release notes',
      tags: ['release'],
      links: [{ url: 'https://example.com/ticket/9' }],
    });
    expect(matchesTaskQuery(t, '', 'Acme Corp')).toBe(true);
    expect(matchesTaskQuery(t, 'ship', 'Acme Corp')).toBe(true);
    expect(matchesTaskQuery(t, 'release notes', 'Acme Corp')).toBe(true);
    expect(matchesTaskQuery(t, 'ticket/9', 'Acme Corp')).toBe(true);
    expect(matchesTaskQuery(t, 'task-1', 'Acme Corp')).toBe(true);
    expect(matchesTaskQuery(t, 'acme', 'Acme Corp')).toBe(true);
    expect(matchesTaskQuery(t, 'nothing-here', 'Acme Corp')).toBe(false);
  });
});

describe('deriveTaskList', () => {
  it('sorts by creation date by default, oldest first, without mutating the input', () => {
    const input = [...tasks];
    const d = deriveTaskList(input, filters(), deps);
    // alpha and delta share a creation date and fall through to the title.
    expect(ids(d)).toEqual(['bravo', 'charlie', 'alpha', 'delta']);
    expect(input.map((t) => t.id)).toEqual(['charlie', 'alpha', 'bravo', 'delta']);
    expect([d.total, d.count, d.filtered, d.dirty]).toEqual([4, 4, false, false]);
  });

  it('sorts newest-created first when reversed', () => {
    expect(ids(deriveTaskList(tasks, filters({ dir: 'desc' }), deps))).toEqual(['alpha', 'delta', 'charlie', 'bravo']);
  });

  it('puts a task with no creation date last whichever way the sort points', () => {
    const some = [task({ id: 'undated', title: 'Zzz' }), task({ id: 'dated', title: 'Aaa', created: '2026-01-01' })];
    expect(ids(deriveTaskList(some, filters(), deps))).toEqual(['dated', 'undated']);
    expect(ids(deriveTaskList(some, filters({ dir: 'desc' }), deps))).toEqual(['dated', 'undated']);
  });

  it('sorts by due date, undated last in both directions', () => {
    expect(ids(deriveTaskList(tasks, filters({ sort: 'due' }), deps))).toEqual(['delta', 'alpha', 'charlie', 'bravo']);
    expect(ids(deriveTaskList(tasks, filters({ sort: 'due', dir: 'desc' }), deps))).toEqual([
      'charlie',
      'alpha',
      'delta',
      'bravo',
    ]);
  });

  it('sorts by title and by configured status order', () => {
    expect(ids(deriveTaskList(tasks, filters({ sort: 'title' }), deps))).toEqual(['alpha', 'bravo', 'charlie', 'delta']);
    expect(ids(deriveTaskList(tasks, filters({ sort: 'title', dir: 'desc' }), deps))).toEqual([
      'delta',
      'charlie',
      'bravo',
      'alpha',
    ]);
    // open (bravo, delta — tie broken by title) → progress → blocked.
    expect(ids(deriveTaskList(tasks, filters({ sort: 'status' }), deps))).toEqual([
      'bravo',
      'delta',
      'alpha',
      'charlie',
    ]);
  });

  it('sorts by priority, most important first, with the unset ones in the middle', () => {
    // alpha (urgent) → bravo and delta (unset = normal, tie broken by title) → charlie (low).
    expect(ids(deriveTaskList(tasks, filters({ sort: 'priority' }), deps))).toEqual([
      'alpha',
      'bravo',
      'delta',
      'charlie',
    ]);
  });

  it('keeps an unset priority in the middle when the priority sort is reversed', () => {
    // Reversing walks the scale the other way rather than herding the unset ones
    // to one end, which is what the date sorts do with a missing date.
    expect(ids(deriveTaskList(tasks, filters({ sort: 'priority', dir: 'desc' }), deps))).toEqual([
      'charlie',
      'bravo',
      'delta',
      'alpha',
    ]);
  });

  it('filters by priority, and counts the unset tasks as normal', () => {
    expect(ids(deriveTaskList(tasks, filters({ priority: 'urgent' }), deps))).toEqual(['alpha']);
    expect(ids(deriveTaskList(tasks, filters({ priority: 'normal' }), deps))).toEqual(['bravo', 'delta']);
    expect(deriveTaskList(tasks, filters(), deps).priorityCounts).toEqual({ urgent: 1, normal: 2, low: 1 });
  });

  it('counts each picker facet with its own selection lifted and the other applied', () => {
    const d = deriveTaskList(tasks, filters({ status: 'open', priority: 'normal' }), deps);
    // Statuses counted over the normal-priority tasks; priorities over the open ones.
    expect(d.statusCounts).toEqual({ open: 2 });
    expect(d.priorityCounts).toEqual({ normal: 2 });
    expect(ids(d)).toEqual(['bravo', 'delta']);
  });

  it('treats a priority filter as filtering, not just as re-ordering', () => {
    const d = deriveTaskList(tasks, filters({ priority: 'low' }), deps);
    expect([d.filtered, d.dirty, d.count]).toEqual([true, true, 1]);
  });

  it('breaks ties on an ascending title whichever way the sort points', () => {
    const sameDue = [
      task({ id: 'b', title: 'Bbb', due: '2026-08-01' }),
      task({ id: 'a', title: 'Aaa', due: '2026-08-01' }),
    ];
    expect(ids(deriveTaskList(sameDue, filters({ sort: 'due' }), deps))).toEqual(['a', 'b']);
    expect(ids(deriveTaskList(sameDue, filters({ sort: 'due', dir: 'desc' }), deps))).toEqual(['a', 'b']);
  });

  it('ranks a status that is not configured last', () => {
    const odd = [task({ id: 'unknown', title: 'Zzz', status: 'mystery' }), task({ id: 'known', title: 'Aaa' })];
    expect(ids(deriveTaskList(odd, filters({ sort: 'status' }), deps))).toEqual(['known', 'unknown']);
  });

  it('filters by query, status and tags', () => {
    expect(ids(deriveTaskList(tasks, filters({ query: 'invoice' }), deps))).toEqual(['bravo']);
    expect(ids(deriveTaskList(tasks, filters({ query: 'globex' }), deps))).toEqual(['delta']);
    expect(ids(deriveTaskList(tasks, filters({ status: 'open' }), deps))).toEqual(['bravo', 'delta']);
    expect(ids(deriveTaskList(tasks, filters({ tags: ['billing'] }), deps))).toEqual(['alpha', 'delta']);
  });

  it('requires every picked tag, not any of them', () => {
    expect(ids(deriveTaskList(tasks, filters({ tags: ['bug', 'billing'] }), deps))).toEqual(['alpha']);
  });

  it('matches tags case-insensitively', () => {
    expect(ids(deriveTaskList(tasks, filters({ tags: ['BILLING'] }), deps))).toEqual(['alpha', 'delta']);
  });

  it('reports filtered separately from dirty, so re-ordering is not "filtering"', () => {
    const sorted = deriveTaskList(tasks, filters({ sort: 'title' }), deps);
    expect([sorted.filtered, sorted.dirty]).toEqual([false, true]);
    const narrowed = deriveTaskList(tasks, filters({ query: 'invoice' }), deps);
    expect([narrowed.filtered, narrowed.dirty, narrowed.count, narrowed.total]).toEqual([true, true, 1, 4]);
  });

  it('counts statuses with every filter except the status one applied', () => {
    const d = deriveTaskList(tasks, filters({ tags: ['billing'], status: 'open' }), deps);
    expect(d.statusCounts).toEqual({ progress: 1, open: 1 });
    expect(ids(d)).toEqual(['delta']);
  });

  it('counts tags over what survived every filter, so a chip cannot promise nothing', () => {
    const d = deriveTaskList(tasks, filters({ status: 'open' }), deps);
    expect(d.tagCounts).toEqual([{ tag: 'billing', count: 1, selected: false }]);
  });

  it('keeps a selected tag listed once it has narrowed everything away', () => {
    const d = deriveTaskList(tasks, filters({ tags: ['billing'], query: 'invoice' }), deps);
    expect(d.count).toBe(0);
    expect(d.tagCounts).toEqual([{ tag: 'billing', count: 0, selected: true }]);
  });
});

// A subtask is drawn as part of the task above it, not as another line on the
// list — so it is not counted like one, not ordered like one, and cannot be shown
// without the parent that says what it belongs to.
describe('deriveTaskList and subtasks', () => {
  const parent = task({ id: 'roll-out', title: 'Roll out', created: '2026-07-01' });
  const stepA = task({ id: 'step-a', title: 'Draft the plan', parentId: 'roll-out', created: '2026-07-30' });
  const stepB = task({ id: 'step-b', title: 'Review the plan', parentId: 'roll-out', created: '2026-07-02' });
  const other = task({ id: 'invoice', title: 'Invoice', created: '2026-07-10' });
  const nested = [parent, stepA, stepB, other];

  it('counts parent tasks only, so one task never reads as four', () => {
    const d = deriveTaskList(nested, filters(), deps);
    expect([d.total, d.count]).toEqual([2, 2]);
    // ...and every row is still there to render.
    expect(ids(d)).toHaveLength(4);
  });

  it('orders the parents and leaves the subtasks in source order under them', () => {
    // By creation date the steps would be b-then-a; they stay written order.
    expect(ids(deriveTaskList(nested, filters({ sort: 'created' }), deps))).toEqual([
      'roll-out',
      'invoice',
      'step-a',
      'step-b',
    ]);
    // The parents flip with the direction; the steps do not.
    expect(ids(deriveTaskList(nested, filters({ dir: 'desc' }), deps))).toEqual([
      'invoice',
      'roll-out',
      'step-a',
      'step-b',
    ]);
  });

  it('brings the parent back for a subtask a query matched, and forces it open', () => {
    const d = deriveTaskList(nested, filters({ query: 'draft' }), deps);
    expect(ids(d)).toEqual(['roll-out', 'step-a']);
    expect([...d.expanded]).toEqual(['roll-out']);
    // The parent is what the list counts, even though the query matched the step.
    expect([d.count, d.total]).toEqual([1, 2]);
  });

  it('leaves the folds alone when nothing is filtering', () => {
    expect([...deriveTaskList(nested, filters(), deps).expanded]).toEqual([]);
    expect([...deriveTaskList(nested, filters({ sort: 'title' }), deps).expanded]).toEqual([]);
  });

  it('counts an orphaned subtask, which the list draws at top level', () => {
    // The Overdue and Upcoming views are slices: the parent is often not in them.
    const d = deriveTaskList([stepA, other], filters(), deps);
    expect([d.total, d.count]).toEqual([2, 2]);
  });
});

// The order is a saved preference (`.worklog/config.json` → `defaultTaskSort`),
// unlike the narrowing, which is session-local. These cover the two things that
// makes true of the pure layer: where a list starts, and what "dirty" measures
// against. The normalization of the stored value is in settings.test.ts.
describe('the configured default order', () => {
  it('starts a list in the saved order rather than the shipped one', () => {
    expect(taskListFiltersFor({ key: 'created', dir: 'desc' })).toEqual({
      ...DEFAULT_TASK_LIST_FILTERS,
      sort: 'created',
      dir: 'desc',
    });
    // Alpha and Delta share a created date; the title tiebreak stays ascending
    // in both directions, so they don't swap when the arrow flips.
    const newestFirst = deriveTaskList(tasks, taskListFiltersFor({ key: 'created', dir: 'desc' }), deps);
    expect(ids(newestFirst)).toEqual(['alpha', 'delta', 'charlie', 'bravo']);
  });

  it('leaves the narrowing alone — only the order is a preference', () => {
    const started = taskListFiltersFor({ key: 'title', dir: 'desc' });
    expect([started.query, started.tags, started.status, started.priority]).toEqual(['', [], '', '']);
  });

  it('measures dirty against the saved order, so a list does not open showing Reset', () => {
    const defaultSort = { key: 'created', dir: 'desc' } as const;
    const opened = deriveTaskList(tasks, taskListFiltersFor(defaultSort), { ...deps, defaultSort });
    expect([opened.filtered, opened.dirty]).toEqual([false, false]);

    // The shipped order is now the deviation, for someone whose default isn't it.
    const shipped = deriveTaskList(tasks, filters(), { ...deps, defaultSort });
    expect(shipped.dirty).toBe(true);
  });

  it('falls back to the shipped order when no preference is passed', () => {
    const d = deriveTaskList(tasks, filters(), deps);
    expect([d.dirty, ids(d)]).toEqual([false, ['bravo', 'charlie', 'alpha', 'delta']]);
  });
});
