// Unit tests for the task lists' nesting order and for the folded-parent set
// that `useCollapsedTasks` persists. Both are pure; the hook is the DOM half.

import { describe, it, expect } from 'vitest';
import {
  canHaveParent,
  deriveSubtaskList,
  parentCandidates,
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

describe('deriveSubtaskList', () => {
  const openA = task({ id: 'a' });
  const openB = task({ id: 'b' });
  const doneA = task({ id: 'x', completed: '2026-08-01' });
  const doneB = task({ id: 'y', completed: '2026-08-02' });
  const mixed = [openA, doneA, openB, doneB];
  const ids = (list: Task[]) => list.map((t) => t.id);

  it('hides the done ones until they are asked for', () => {
    const hidden = deriveSubtaskList(mixed, false);
    expect(ids(hidden.visible)).toEqual(['a', 'b']);
    expect(hidden).toMatchObject({ doneCount: 2, showingDone: false, canToggle: true });
  });

  it('puts the done ones last, in source order, when they are shown', () => {
    expect(ids(deriveSubtaskList(mixed, true).visible)).toEqual(['a', 'b', 'x', 'y']);
  });

  it('shows an all-done list whatever the toggle says, so the card is never empty', () => {
    const allDone = deriveSubtaskList([doneA, doneB], false);
    expect(ids(allDone.visible)).toEqual(['x', 'y']);
    // ...and offers no toggle, since there is nothing left to hide it in favour of.
    expect(allDone).toMatchObject({ doneCount: 2, showingDone: true, canToggle: false });
  });

  it('offers no toggle when nothing is done', () => {
    expect(deriveSubtaskList([openA, openB], false)).toMatchObject({ doneCount: 0, canToggle: false });
    expect(deriveSubtaskList([], false)).toMatchObject({ visible: [], doneCount: 0, canToggle: false });
  });
});

describe('parentCandidates', () => {
  const other = task({ id: 'p3', clientIds: ['globex'] });
  const closed = task({ id: 'p4', completed: '2026-08-01' });
  const all = [parent, kidA, kidB, lone, other, closed];
  const ids = (list: Task[]) => list.map((t) => t.id);

  it('offers the client\'s open top-level tasks, and only those', () => {
    // No subtask (it would nest two deep), no other client (the two blocks live
    // in different files), no archived task, and never the task itself.
    expect(ids(parentCandidates(all, { id: 'p2', clientId: 'acme' }))).toEqual(['p1']);
  });

  it('offers everything to a task being created', () => {
    expect(ids(parentCandidates(all, { clientId: 'acme' }))).toEqual(['p1', 'p2']);
  });

  it('cannot offer a task its own subtask, so the tree cannot cycle', () => {
    expect(ids(parentCandidates(all, { id: 'p1', clientId: 'acme' }))).toEqual(['p2']);
  });

  it('keeps the parent the task already has, whatever it looks like now', () => {
    // A parent completed since — the picker still has to be able to name the
    // value it is standing for.
    expect(ids(parentCandidates(all, { id: 'k1', clientId: 'acme', parentId: 'p4' }))).toEqual(['p1', 'p2', 'p4']);
  });
});

describe('canHaveParent', () => {
  const all = [parent, kidA, lone];

  it('says no to a task that is already a parent', () => {
    expect(canHaveParent(all, 'p1')).toBe(false);
  });

  it('says yes to a childless task, and to one that does not exist yet', () => {
    expect(canHaveParent(all, 'p2')).toBe(true);
    expect(canHaveParent(all, null)).toBe(true);
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
