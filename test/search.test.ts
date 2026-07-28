// Unit tests for the search overlay's pure derivation — in particular the tag
// filter, which doubles as a standalone way to browse everything tagged X.

import { describe, it, expect } from 'vitest';
import { deriveSearch, type SearchFilters } from '../src/ui/utils/search';
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
  clientIdOf: (t: Task) => t.clientIds[0] ?? '',
  clientName: (id: string) => (id === 'acme' ? 'Acme Corp' : 'Globex'),
  colorOf: () => '#000',
  statusMeta: () => ({ label: 'Open', color: '#000' }),
  isDone: (t: Task) => !!t.completed,
  linksOf: (t: Task) => t.links.map((l) => l.url),
  onEdit: () => () => {},
};

const filters = (over: Partial<SearchFilters> = {}): SearchFilters => ({
  query: '',
  scope: 'all',
  client: '',
  tags: [],
  ...over,
});

const tasks: Task[] = [
  task({ id: 'mobile-bug', title: 'Fix the mobile picker', tags: ['mobile', 'bug'] }),
  task({ id: 'mobile-nav', title: 'Mobile nav polish', tags: ['Mobile'] }),
  task({ id: 'billing', title: 'Send July invoice', tags: ['billing'], clientIds: ['globex'] }),
  task({ id: 'closed-bug', title: 'Old crash', tags: ['bug'], completed: '2026-05-01' }),
  task({ id: 'untagged', title: 'Untagged mobile note' }),
];

const ids = (d: ReturnType<typeof deriveSearch>) => d.flat.map((r) => r.title);

describe('deriveSearch', () => {
  it('is unfiltered with neither a query nor tags', () => {
    const d = deriveSearch(tasks, filters(), deps);
    expect(d.filtered).toBe(false);
    expect(d.count).toBe(0);
    expect(d.openCount).toBe(4);
    expect(d.archivedCount).toBe(1);
  });

  it('filters on tags alone, with no query', () => {
    const d = deriveSearch(tasks, filters({ tags: ['bug'] }), deps);
    expect(d.filtered).toBe(true);
    expect(ids(d)).toEqual(['Fix the mobile picker', 'Old crash']);
    // Nothing to highlight when the match didn't come from a query.
    expect(d.flat.every((r) => !r.hasMid)).toBe(true);
  });

  it('matches tags case-insensitively', () => {
    expect(ids(deriveSearch(tasks, filters({ tags: ['mobile'] }), deps))).toEqual([
      'Fix the mobile picker',
      'Mobile nav polish',
    ]);
  });

  it('requires every selected tag', () => {
    expect(ids(deriveSearch(tasks, filters({ tags: ['mobile', 'bug'] }), deps))).toEqual(['Fix the mobile picker']);
    expect(deriveSearch(tasks, filters({ tags: ['mobile', 'billing'] }), deps).count).toBe(0);
  });

  it('narrows a query by tag rather than widening it', () => {
    // "mobile" alone also hits the untagged task through its title.
    expect(ids(deriveSearch(tasks, filters({ query: 'mobile' }), deps))).toContain('Untagged mobile note');
    expect(ids(deriveSearch(tasks, filters({ query: 'mobile', tags: ['bug'] }), deps))).toEqual([
      'Fix the mobile picker',
    ]);
  });

  it('still applies the scope and client filters', () => {
    expect(ids(deriveSearch(tasks, filters({ tags: ['bug'], scope: 'open' }), deps))).toEqual(['Fix the mobile picker']);
    expect(ids(deriveSearch(tasks, filters({ tags: ['bug'], scope: 'archived' }), deps))).toEqual(['Old crash']);
    expect(deriveSearch(tasks, filters({ tags: ['bug'], client: 'globex' }), deps).count).toBe(0);
  });

  it('groups tag hits by client', () => {
    const d = deriveSearch(tasks, filters({ tags: ['bug', 'billing'] }), deps);
    expect(d.count).toBe(0);
    const both = deriveSearch(tasks, filters({ query: 'e' }), deps);
    expect(both.groups.map((g) => g.name)).toEqual(['Acme Corp', 'Globex']);
  });
});
