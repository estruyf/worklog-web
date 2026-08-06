// What the app icon's badge claims. The number has to agree with the Overdue
// view, which is the page it sends you to — a badge saying 3 that opens onto 2
// tasks is worse than no badge — so the double-count case (a recurring task that
// is both late and lands today) and the "not loaded yet" case are pinned here.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { attentionCount, showAppBadge } from '../src/ui/appBadge';
import { parseRecurrence } from '../src/model/recurrence';
import type { Task } from '../src/model/types';

function task(fields: Partial<Task> & { id: string }): Task {
  return {
    title: fields.id,
    status: 'open',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'clients/acme.md',
    sourceLine: 0,
    ...fields,
  };
}

// A Thursday.
const TODAY = '2026-08-06';

describe('attentionCount', () => {
  it('counts what is late and what lands today, and nothing else', () => {
    const tasks = [
      task({ id: 'late', due: '2026-07-20' }),
      task({ id: 'today', due: TODAY }),
      task({ id: 'tomorrow', due: '2026-08-07' }),
      task({ id: 'nodue' }),
    ];
    expect(attentionCount(tasks, TODAY)).toBe(2);
  });

  it('ignores completed tasks, however late they were', () => {
    const tasks = [
      task({ id: 'done-late', due: '2026-01-05', completed: '2026-08-01' }),
      task({ id: 'done-today', due: TODAY, completed: TODAY }),
    ];
    expect(attentionCount(tasks, TODAY)).toBe(0);
  });

  it('counts a recurring task that is both late and due today only once', () => {
    // A daily standup last due on the 4th: overdue by its stored date, and the
    // rule also puts an occurrence on today. One task, one badge unit — the same
    // call the Overdue view makes when it keeps it out of "Due today".
    const daily = task({ id: 'standup', due: '2026-08-04', repeat: parseRecurrence('daily') });
    expect(attentionCount([daily], TODAY)).toBe(1);
  });

  it('still counts a recurring task whose occurrence fell on a day nobody worked', () => {
    // "Invoices on the 1st" landed on a Saturday, so no day matches the rule any
    // more — being overdue is the only thing keeping it on the badge.
    const invoices = task({ id: 'invoices', due: '2026-08-01', repeat: parseRecurrence('monthly on 1') });
    expect(attentionCount([invoices], '2026-08-03')).toBe(1);
  });

  it('reports nothing before the app knows what day it is', () => {
    // An empty `today` sorts before every date string; without the guard every
    // open task would read as late and the icon would badge the whole backlog.
    expect(attentionCount([task({ id: 'late', due: '2026-07-20' })], '')).toBe(0);
  });
});

describe('showAppBadge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a no-op where the API does not exist, rather than throwing', () => {
    // Firefox, and every browser tab that was never installed.
    vi.stubGlobal('navigator', {});
    expect(() => showAppBadge(3)).not.toThrow();
  });

  it('sets a count and clears at zero', () => {
    const setAppBadge = vi.fn(() => Promise.resolve());
    const clearAppBadge = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { setAppBadge, clearAppBadge });

    showAppBadge(4);
    expect(setAppBadge).toHaveBeenCalledWith(4);
    expect(clearAppBadge).not.toHaveBeenCalled();

    showAppBadge(0);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejection — a declined permission is not the app’s problem', async () => {
    const rejected = Promise.reject(new Error('denied'));
    vi.stubGlobal('navigator', { setAppBadge: () => rejected, clearAppBadge: () => Promise.resolve() });

    expect(() => showAppBadge(1)).not.toThrow();
    // If the catch inside showAppBadge hadn't attached, this would surface as an
    // unhandled rejection rather than a passing assertion.
    await expect(rejected.catch(() => 'handled')).resolves.toBe('handled');
  });
});
