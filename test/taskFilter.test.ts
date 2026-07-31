// Unit tests for the open-task lists' pure filter/sort derivation.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_LIST_FILTERS,
  deriveTaskList,
  matchesTaskQuery,
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
  task({ id: 'charlie', title: 'Charlie', created: '2026-07-02', due: '2026-08-10', status: 'blocked', tags: ['bug'] }),
  task({
    id: 'alpha',
    title: 'Alpha',
    created: '2026-07-20',
    due: '2026-08-01',
    status: 'progress',
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
