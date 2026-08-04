// Unit tests for the search overlay's pure derivation — in particular the tag
// filter, which doubles as a standalone way to browse everything tagged X, and
// the day-note group, which is appended to the task hits rather than mixed in.

import { describe, it, expect } from 'vitest';
import {
  appendGroup,
  deriveNoteGroup,
  deriveSearch,
  snippetAround,
  NOTE_GROUP_NAME,
  type SearchFilters,
} from '../src/ui/utils/search';
import type { DayNote, Task } from '../src/model/types';

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

const notes: DayNote[] = [
  { date: '2026-07-01', body: 'Kickoff with Globex. They want the uploader first.', sourceFile: 'notes/2026-07.md', sourceLine: 2 },
  { date: '2026-07-16', body: 'Export queue prototype. Renders, no pagination yet.', sourceFile: 'notes/2026-07.md', sourceLine: 8 },
  { date: '2026-08-03', body: 'Standup ran long.', sourceFile: 'notes/2026-08.md', sourceLine: 2 },
];

const noteDeps = { onOpen: () => () => {} };

describe('deriveNoteGroup', () => {
  it('yields nothing without a query — a tags-only browse is a task idea', () => {
    expect(deriveNoteGroup(notes, filters(), noteDeps)).toBeUndefined();
    expect(deriveNoteGroup(notes, filters({ tags: ['bug'] }), noteDeps)).toBeUndefined();
  });

  it('matches the body case-insensitively, newest day first', () => {
    const g = deriveNoteGroup(notes, filters({ query: 'RAN' }), noteDeps)!;
    expect(g.name).toBe(NOTE_GROUP_NAME);
    expect(g.count).toBe(1);
    const all = deriveNoteGroup(notes, filters({ query: 'n' }), noteDeps)!;
    expect(all.rows.map((r) => r.title)).toEqual(['Mon 3 Aug 2026', 'Thu 16 Jul 2026', 'Wed 1 Jul 2026']);
    expect(all.rows.every((r) => r.kind === 'note')).toBe(true);
  });

  it('matches the date itself, so "2026-07" browses a month', () => {
    const g = deriveNoteGroup(notes, filters({ query: '2026-07' }), noteDeps)!;
    expect(g.count).toBe(2);
  });

  it('yields nothing under a scope, client or tag filter a note cannot satisfy', () => {
    expect(deriveNoteGroup(notes, filters({ query: 'ran', scope: 'open' }), noteDeps)).toBeUndefined();
    expect(deriveNoteGroup(notes, filters({ query: 'ran', scope: 'archived' }), noteDeps)).toBeUndefined();
    expect(deriveNoteGroup(notes, filters({ query: 'ran', client: 'acme' }), noteDeps)).toBeUndefined();
    expect(deriveNoteGroup(notes, filters({ query: 'ran', tags: ['bug'] }), noteDeps)).toBeUndefined();
  });

  it('yields nothing when nothing matches', () => {
    expect(deriveNoteGroup(notes, filters({ query: 'nowhere' }), noteDeps)).toBeUndefined();
  });
});

describe('snippetAround', () => {
  it('centres the excerpt on the match and marks where it cut', () => {
    const text = `${'a'.repeat(200)} needle ${'b'.repeat(200)}`;
    const s = snippetAround(text, 'needle', 10);
    expect(s).toBe('…aaaaaaaaa needle bbbbbbbbb…');
  });

  it('collapses whitespace so a multi-line body fits one row', () => {
    expect(snippetAround('one\n\n  two   three\n', 'two')).toBe('one two three');
  });

  it('falls back to the head of the text when the query is absent', () => {
    expect(snippetAround('short body', 'zzz')).toBe('short body');
  });
});

describe('appendGroup', () => {
  it('puts note rows after task rows in both groups and flat', () => {
    const tasksDerived = deriveSearch(tasks, filters({ query: 'e' }), deps);
    const noteGroup = deriveNoteGroup(notes, filters({ query: 'e' }), noteDeps);
    const d = appendGroup(tasksDerived, noteGroup, notes.length);

    expect(d.groups.map((g) => g.name)).toEqual(['Acme Corp', 'Globex', NOTE_GROUP_NAME]);
    expect(d.count).toBe(tasksDerived.count + noteGroup!.count);
    expect(d.flat).toHaveLength(d.count);
    // The shell's ↑/↓/↵ indexes straight into `flat`, so it has to stay in the
    // order the overlay renders the groups.
    expect(d.flat.slice(0, tasksDerived.count).every((r) => r.kind === 'task')).toBe(true);
    expect(d.flat.slice(tasksDerived.count).every((r) => r.kind === 'note')).toBe(true);
    expect(d.noteCount).toBe(3);
  });

  it('leaves the derivation alone but still reports the total when there is no group', () => {
    const tasksDerived = deriveSearch(tasks, filters({ query: 'mobile' }), deps);
    const d = appendGroup(tasksDerived, undefined, notes.length);
    expect(d.groups).toEqual(tasksDerived.groups);
    expect(d.count).toBe(tasksDerived.count);
    expect(d.noteCount).toBe(3);
  });
});
