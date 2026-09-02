// Unit tests for the status board's columns. The point of these is that the
// board can't hide work: every status the open list actually carries has to get
// a column, including the ids left behind by a status the user removed. The
// closing status is a column too, and always the last one — the board treats it
// as a place, and a column after it would read as somewhere further to go.

import { describe, it, expect } from 'vitest';
import { boardColumns } from '../src/ui/utils/board';
import { DEFAULT_STATUSES, normalizeStatuses } from '../src/model/status';

const task = (status: string) => ({ status });

describe('boardColumns', () => {
  it('draws the statuses in config order, closing last', () => {
    const columns = boardColumns(DEFAULT_STATUSES, [task('open'), task('in-progress')]);
    expect(columns.map((c) => c.id)).toEqual(['open', 'in-progress', 'done']);
    expect(columns.map((c) => c.name)).toEqual(['Open', 'In progress', 'Closed']);
  });

  it('flags exactly one column as the closing one', () => {
    const columns = boardColumns(DEFAULT_STATUSES, []);
    expect(columns.filter((c) => c.terminal).map((c) => c.id)).toEqual(['done']);
    // Absent rather than false, so a column is either flagged or plainly isn't.
    expect(columns[0].terminal).toBeUndefined();
  });

  it('keeps every column even when nothing sits in it', () => {
    expect(boardColumns(DEFAULT_STATUSES, []).map((c) => c.id)).toEqual(['open', 'in-progress', 'done']);
  });

  it('gives a removed status its own column while tasks are still in it', () => {
    const statuses = normalizeStatuses([
      { id: 'open', label: 'Open' },
      { id: 'done', label: 'Closed', terminal: true },
    ]);
    const columns = boardColumns(statuses, [task('open'), task('waiting-for'), task('waiting-for')]);
    expect(columns.map((c) => c.id)).toEqual(['open', 'waiting-for', 'done']);
    // Nothing configured to read it from, so the id is the heading.
    expect(columns[1].name).toBe('waiting-for');
    expect(columns[1].terminal).toBeUndefined();
  });

  it('orders the leftovers by id, after the configured ones', () => {
    const columns = boardColumns(DEFAULT_STATUSES, [task('review'), task('blocked'), task('open')]);
    expect(columns.map((c) => c.id)).toEqual(['open', 'in-progress', 'blocked', 'review', 'done']);
  });

  it('takes the configured colour, and falls back for a status without one', () => {
    const statuses = normalizeStatuses([
      { id: 'open', label: 'Open', color: '#123456' },
      { id: 'done', label: 'Closed', terminal: true },
    ]);
    const columns = boardColumns(statuses, [task('mystery')]);
    expect(columns[0].color).toBe('#123456');
    expect(columns[1].color).toMatch(/^#/);
    expect(columns[2].color).toMatch(/^#/);
  });

  it('gives a task parked in the closing status the closing column, not a second one', () => {
    // Only reachable by hand-editing the Markdown — a `- status: done` with no
    // completion date. It belongs in the column that is already there.
    const columns = boardColumns(DEFAULT_STATUSES, [task('done')]);
    expect(columns.map((c) => c.id)).toEqual(['open', 'in-progress', 'done']);
  });

  it('draws no closing column for a config that somehow has none', () => {
    // `normalizeStatuses` guarantees one, so this is only reachable by handing
    // raw defs straight in — the board should still not invent a place to drop.
    const columns = boardColumns([{ id: 'open', label: 'Open' }], [task('open')]);
    expect(columns.map((c) => c.id)).toEqual(['open']);
    expect(columns.some((c) => c.terminal)).toBe(false);
  });
});
