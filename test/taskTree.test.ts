// Unit tests for the task lists' nesting order and for the folded-parent set
// that `useCollapsedTasks` persists. Both are pure; the hook is the DOM half.

import { describe, it, expect } from 'vitest';
import {
  parseCollapsedStore,
  planTaskRows,
  pruneCollapsed,
  toggleCollapsed,
  type CollapsedStore,
} from '../src/ui/utils/taskTree';
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

const parent = task({ id: 'p1' });
const kidA = task({ id: 'k1', parentId: 'p1' });
const kidB = task({ id: 'k2', parentId: 'p1' });
const lone = task({ id: 'p2' });

/** `id:child` per line, so an assertion reads like the list on screen. */
const shape = (list: Task[], collapsed?: Set<string>) =>
  planTaskRows(list, collapsed).map((p) => `${p.task.id}${p.child ? ':child' : ''}`);

describe('planTaskRows', () => {
  it('nests subtasks under their parent', () => {
    expect(shape([parent, lone, kidA, kidB])).toEqual(['p1', 'k1:child', 'k2:child', 'p2']);
  });

  it('marks a parent foldable only when its subtasks are in the same list', () => {
    const withKids = planTaskRows([parent, kidA]);
    expect(withKids[0]).toMatchObject({ foldable: true, collapsed: false });
    expect(withKids[1]).toMatchObject({ foldable: false, collapsed: false });
    // A filter that removed every subtask leaves nothing to fold away.
    expect(planTaskRows([parent])[0]).toMatchObject({ foldable: false, collapsed: false });
  });

  it('drops the subtasks of a folded parent but keeps the parent', () => {
    expect(shape([parent, kidA, kidB, lone], new Set(['p1']))).toEqual(['p1', 'p2']);
    expect(planTaskRows([parent, kidA], new Set(['p1']))[0]).toMatchObject({ foldable: true, collapsed: true });
  });

  it('ignores a fold on a task with no subtasks in the list', () => {
    expect(shape([parent, lone], new Set(['p1', 'p2']))).toEqual(['p1', 'p2']);
  });

  it('keeps an orphaned subtask at top level rather than losing it', () => {
    // The Overdue and search-adjacent lists are slices: the parent is often not
    // in them, and the subtask still has to show up — after the rows that nest,
    // since it has nothing to nest under.
    expect(shape([kidA, lone])).toEqual(['p2', 'k1']);
    // ...and folding a parent that isn't in the list can't smuggle it back out.
    expect(shape([kidA], new Set(['p1']))).toEqual(['k1']);
  });
});

describe('parseCollapsedStore', () => {
  it('reads what was written', () => {
    expect(parseCollapsedStore('{"o/r/main":["p1","p2"]}')).toEqual({ 'o/r/main': ['p1', 'p2'] });
  });

  it('falls back to empty on anything it cannot use', () => {
    for (const raw of [null, '', 'not json', '[]', '"p1"', 'null', '{"o/r/main":"p1"}', '{"o/r/main":[]}']) {
      expect(parseCollapsedStore(raw)).toEqual({});
    }
  });

  it('drops non-string ids rather than letting them reach the lookup', () => {
    expect(parseCollapsedStore('{"o/r/main":["p1",7,null,"",{"id":"p2"}]}')).toEqual({ 'o/r/main': ['p1'] });
  });
});

describe('toggleCollapsed', () => {
  it('folds, then unfolds', () => {
    const folded = toggleCollapsed({}, 'o/r/main', 'p1');
    expect(folded).toEqual({ 'o/r/main': ['p1'] });
    expect(toggleCollapsed(folded, 'o/r/main', 'p1')).toEqual({});
  });

  it('leaves the other repos alone', () => {
    const store: CollapsedStore = { 'o/other/main': ['p9'] };
    expect(toggleCollapsed(store, 'o/r/main', 'p1')).toEqual({ 'o/other/main': ['p9'], 'o/r/main': ['p1'] });
    expect(store).toEqual({ 'o/other/main': ['p9'] });
  });
});

describe('pruneCollapsed', () => {
  it('forgets folds for tasks that are gone', () => {
    const store: CollapsedStore = { 'o/r/main': ['p1', 'gone'], 'o/other/main': ['p9'] };
    expect(pruneCollapsed(store, 'o/r/main', new Set(['p1']))).toEqual({
      'o/r/main': ['p1'],
      'o/other/main': ['p9'],
    });
  });

  it('returns the same object when nothing changed, so no write follows', () => {
    const store: CollapsedStore = { 'o/r/main': ['p1'] };
    expect(pruneCollapsed(store, 'o/r/main', new Set(['p1', 'p2']))).toBe(store);
    expect(pruneCollapsed(store, 'o/unopened/main', new Set(['p1']))).toBe(store);
  });
});
