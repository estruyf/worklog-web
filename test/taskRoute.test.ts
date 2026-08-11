// The open task's history plumbing. A task used to be an overlay on a same-URL
// entry, so the thing you were looking at had no address to share. It is a route
// now, and what the overlay got right has to survive the move: closing lands back
// where you opened it from, a subtask stacks so Back walks up the chain, and a
// task reached by a shared link — which has no entry of ours behind it — still
// closes onto something.

import { describe, it, expect, vi } from 'vitest';
import { installWindow, type FakeHistoryOptions } from './helpers/fakeHistory';

async function setup(initial?: string, options?: FakeHistoryOptions) {
  vi.resetModules();
  const win = installWindow(initial, options);
  const router = await import('../src/ui/router');
  return { ...win, ...router };
}

describe('task route', () => {
  it('gives the open task an address of its own', async () => {
    const r = await setup();
    r.navigateToView('calendar');

    r.navigateToTask('t-1');

    expect(window.location.pathname).toBe('/app/task/t-1');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-1' });
  });

  it('encodes ids that would otherwise read as more path', async () => {
    const r = await setup();
    r.navigateToTask('a/b');

    expect(window.location.pathname).toBe('/app/task/a%2Fb');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 'a/b' });
  });

  it('keeps the query string that selects the mounted repo', async () => {
    const r = await setup('/app?owner=elio&repo=timesheet');

    r.navigateToTask('t-1');

    expect(window.location.search).toBe('?owner=elio&repo=timesheet');
  });

  it('closes back onto the view it was opened from', async () => {
    const r = await setup();
    r.navigateToView('calendar');
    r.navigateToTask('t-1');

    r.closeTask();

    expect(window.location.pathname).toBe('/app/calendar');
  });

  it('walks back off its own entry rather than pushing another', async () => {
    const r = await setup();
    r.navigateToView('calendar');
    const before = r.at();
    r.navigateToTask('t-1');
    r.closeTask();

    // Back at the entry the task was opened from, not one further along it —
    // otherwise the browser's Back would return to the task just closed.
    expect(r.at()).toBe(before);
  });

  it('stacks a subtask, so closing walks back up the chain', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');

    r.closeTask();
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-parent' });

    r.closeTask();
    expect(window.location.pathname).toBe('/app/todos');
  });

  it('re-opens the task you are on in place rather than stacking an entry', async () => {
    const r = await setup();
    r.navigateToTask('t-1');
    const depthAfterOpen = r.depth();

    r.navigateToTask('t-1');

    expect(r.depth()).toBe(depthAfterOpen);
  });

  it('walks back onto the parent a subtask was opened from', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    const atParent = r.at();
    r.navigateToTask('t-child');

    r.navigateBackToTask('t-parent');

    // The entry the subtask was opened from, not a second copy of the parent on
    // top of it: stepping through a parent's subtasks must not pile up a chain.
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-parent' });
    expect(r.at()).toBe(atParent);
  });

  it('leaves the parent’s own way out pointing at the view', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');
    r.navigateBackToTask('t-parent');

    r.closeTask();

    expect(window.location.pathname).toBe('/app/todos');
  });

  it('goes to a task that is not behind us by pushing, not by walking back', async () => {
    const r = await setup();
    r.navigateToView('todos');
    // The header doesn't offer this — it only names the parent you arrived from —
    // but the helper is "go to this task", and going somewhere must not be a
    // back() onto whatever happens to be behind.
    r.navigateToTask('t-child');

    r.navigateBackToTask('t-parent');

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-parent' });
    r.closeTask();
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-child' });
  });

  it('keeps what an entry was opened from when the task is re-opened in place', async () => {
    const r = await setup();
    r.navigateToTask('t-parent');
    const atParent = r.at();
    r.navigateToTask('t-child');
    // A save, a status change — anything that re-opens the task you are already
    // on. It replaces the entry, and the replacement must not read as the subtask
    // having been opened from itself.
    r.navigateToTask('t-child');

    r.navigateBackToTask('t-parent');

    expect(r.at()).toBe(atParent);
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-parent' });
  });

  it('ignores a second back-to-parent while the first has not landed yet', async () => {
    const r = await setup(undefined, { asyncPop: true });
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');

    r.navigateBackToTask('t-parent');
    r.navigateBackToTask('t-parent');
    await Promise.resolve();

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-parent' });
  });

  it('sends a task URL with no id to the dashboard', async () => {
    const r = await setup('/app/task');

    expect(window.location.pathname).toBe('/app');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'view', view: 'day' });
  });

  it('sends one with a trailing slash there too', async () => {
    const r = await setup('/app/task/');

    expect(window.location.pathname).toBe('/app');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'view', view: 'day' });
  });

  it('keeps the repo the truncated link was pointing at', async () => {
    await setup('/app/task?owner=elio&repo=timesheet');

    expect(window.location.pathname).toBe('/app');
    expect(window.location.search).toBe('?owner=elio&repo=timesheet');
  });

  it('replaces the bare path rather than pushing over it', async () => {
    const r = await setup('/app/task');

    // Back would otherwise return to a URL that only redirects here again.
    expect(r.depth()).toBe(1);
  });

  it('still 404s a path that is wrong rather than truncated', async () => {
    const r = await setup('/app/nope');

    expect(window.location.pathname).toBe('/app/nope');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'notFound' });
  });

  it('does nothing when there is no task to close', async () => {
    const r = await setup();
    r.navigateToView('calendar');
    const before = r.at();

    // A tag chip on a task row closes the open task before opening the search;
    // from a view there is none, and it must not navigate anywhere for that.
    r.closeTask();

    expect(window.location.pathname).toBe('/app/calendar');
    expect(r.at()).toBe(before);
  });

  it('closes a shared link onto the dashboard rather than out of the app', async () => {
    const r = await setup('/app/task/t-1');

    // Nothing of ours pushed this entry: going back would leave the site.
    r.closeTask();

    expect(window.location.pathname).toBe('/app');
  });

  it('ignores a second close while the first has not landed yet', async () => {
    // Real popstate is async, so the task still reads as open in that window and a
    // second request — deleting one closes it from two places — would pop an extra
    // entry and drop the user a level below where they opened it.
    const r = await setup(undefined, { asyncPop: true });
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');

    r.closeTask();
    r.closeTask();
    await Promise.resolve();

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-parent' });
  });
});

// What the detail header offers as the way out. Having a parent is not the test:
// the same subtask is opened from its parent, from the day it is due on and from
// a pasted link, and only the first has a list behind it worth going back to.
describe('the task an entry was opened from', () => {
  it('is the task a subtask was opened from', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');

    expect(r.openedFromTaskId()).toBe('t-parent');
  });

  it('is nothing for a subtask opened straight from a view', async () => {
    const r = await setup();
    r.navigateToView('day');
    r.navigateToTask('t-child');

    expect(r.openedFromTaskId()).toBeNull();
  });

  it('is nothing for a subtask reached by a shared link', async () => {
    const r = await setup('/app/task/t-child');

    expect(r.openedFromTaskId()).toBeNull();
  });

  it('is nothing once the parent itself is the task on screen', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');

    expect(r.openedFromTaskId()).toBeNull();
  });

  it('survives a re-open of the task in place', async () => {
    const r = await setup();
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');
    r.navigateToTask('t-child');

    expect(r.openedFromTaskId()).toBe('t-parent');
  });

  it('comes back with the entry when the chain is walked', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');
    // Off the subtask, then onto another one from the same parent.
    r.closeTask();
    r.navigateToTask('t-other-child');

    expect(r.openedFromTaskId()).toBe('t-parent');
  });

  it('is dropped on the way back out to a view', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTask('t-parent');
    r.navigateToTask('t-child');
    r.closeTask();

    r.navigateToView('day');

    expect(r.openedFromTaskId()).toBeNull();
  });
});
