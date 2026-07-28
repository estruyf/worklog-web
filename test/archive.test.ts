// Unit tests for the Archive view's pure filter/pagination derivation.

import { describe, it, expect } from 'vitest';
import { deriveArchive, pageWindow, periodStart, type ArchiveFilters } from '../src/ui/utils/archive';
import type { Task } from '../src/model/types';

const TODAY = '2026-07-27';

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.id,
    status: 'done',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'archive/acme/2026.md',
    sourceLine: 0,
    ...over,
  };
}

const deps = {
  clientName: (id: string) => (id === 'acme' ? 'Acme Corp' : 'Globex'),
  colorOf: () => '#000',
  today: TODAY,
};

const filters = (over: Partial<ArchiveFilters> = {}): ArchiveFilters => ({
  query: '',
  clientId: '',
  period: 'all',
  page: 1,
  pageSize: 25,
  ...over,
});

describe('periodStart', () => {
  it('counts back an inclusive window and anchors the year', () => {
    expect(periodStart('all', TODAY)).toBe('');
    expect(periodStart('30d', TODAY)).toBe('2026-06-28');
    expect(periodStart('90d', TODAY)).toBe('2026-04-29');
    expect(periodStart('year', TODAY)).toBe('2026-01-01');
  });
});

describe('deriveArchive', () => {
  const tasks: Task[] = [
    task({ id: 'open-one', status: 'active', completed: undefined }),
    task({ id: 'newest', completed: '2026-07-20', tags: ['billing'] }),
    task({ id: 'mid', completed: '2026-05-02', description: 'invoice follow-up' }),
    task({ id: 'old', completed: '2025-11-11', clientIds: ['globex'], links: [{ url: 'https://example.com/ticket/9' }] }),
  ];

  it('keeps only completed tasks, newest first', () => {
    const d = deriveArchive(tasks, filters(), deps);
    expect(d.totalCount).toBe(3);
    expect(d.filteredCount).toBe(3);
    expect(d.groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(['newest', 'mid', 'old']);
    expect(d.groups.map((g) => g.id)).toEqual(['acme', 'globex']);
    expect(d.from).toBe(1);
    expect(d.to).toBe(3);
  });

  it('matches the query against title, description, tags, links and client name', () => {
    const ids = (query: string) =>
      deriveArchive(tasks, filters({ query }), deps)
        .groups.flatMap((g) => g.tasks.map((t) => t.id));
    expect(ids('NEWEST')).toEqual(['newest']);
    expect(ids('billing')).toEqual(['newest']);
    expect(ids('invoice')).toEqual(['mid']);
    expect(ids('ticket/9')).toEqual(['old']);
    expect(ids('globex')).toEqual(['old']);
    expect(ids('nothing-here')).toEqual([]);
  });

  it('filters by client and period', () => {
    expect(deriveArchive(tasks, filters({ clientId: 'globex' }), deps).filteredCount).toBe(1);
    expect(deriveArchive(tasks, filters({ period: 'year' }), deps).filteredCount).toBe(2);
    expect(deriveArchive(tasks, filters({ period: '90d' }), deps).filteredCount).toBe(2);
    expect(deriveArchive(tasks, filters({ period: '30d' }), deps).filteredCount).toBe(1);
  });

  it('counts clients with every filter except the client one applied', () => {
    const d = deriveArchive(tasks, filters({ clientId: 'globex', period: 'year' }), deps);
    expect(d.clientCounts).toEqual({ acme: 2 });
    expect(d.filteredCount).toBe(0);
  });

  it('pages the filtered list and clamps an out-of-range page', () => {
    const p1 = deriveArchive(tasks, filters({ pageSize: 2 }), deps);
    expect(p1.pageCount).toBe(2);
    expect(p1.groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(['newest', 'mid']);
    expect([p1.from, p1.to]).toEqual([1, 2]);

    const p2 = deriveArchive(tasks, filters({ pageSize: 2, page: 2 }), deps);
    expect(p2.groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(['old']);
    expect([p2.from, p2.to]).toEqual([3, 3]);

    const clamped = deriveArchive(tasks, filters({ pageSize: 2, page: 99 }), deps);
    expect(clamped.page).toBe(2);
    expect(clamped.groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual(['old']);
  });

  it('reports an empty range when nothing matches', () => {
    const d = deriveArchive(tasks, filters({ query: 'zzz' }), deps);
    expect([d.filteredCount, d.from, d.to, d.pageCount, d.groups.length]).toEqual([0, 0, 0, 1, 0]);
  });
});

describe('pageWindow', () => {
  it('lists every page when they fit', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('elides runs around the current page', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
  });
});
