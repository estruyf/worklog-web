// The task form's history plumbing. The form owns its fields and starts over by
// being remounted, so two things have to hold: the seed it starts from survives
// the navigation, and the instance key changes on every fresh open — including
// re-opening the form you are already on, which is the case a path-only key
// silently gets wrong.

import { describe, it, expect, vi } from 'vitest';
import { installWindow } from './helpers/fakeHistory';

async function setup(initial?: string) {
  vi.resetModules();
  const win = installWindow(initial);
  const router = await import('../src/ui/router');
  return { ...win, ...router };
}

describe('task form route', () => {
  it('carries the seed to the form without putting it in the URL', async () => {
    const r = await setup();
    r.navigateToTaskForm(null, { clientId: 'acme', parentId: 't-1', due: '2026-08-01' });

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'taskForm', taskId: null });
    expect(window.location.pathname).toBe('/app/new');
    expect(r.taskFormInstance().seed).toEqual({ clientId: 'acme', parentId: 't-1', due: '2026-08-01' });
  });

  it('gives every open its own instance key, so the form starts over', async () => {
    const r = await setup();
    r.navigateToTaskForm(null, { clientId: 'acme' });
    const first = r.taskFormInstance().key;

    // Opening the form again from a different place — same path, different seed.
    r.navigateToTaskForm(null, { clientId: 'globex', parentId: 't-9' });
    const second = r.taskFormInstance().key;

    expect(second).not.toBe(first);
    expect(r.taskFormInstance().seed).toEqual({ clientId: 'globex', parentId: 't-9' });
  });

  it('re-opens in place rather than stacking a second entry to walk back off', async () => {
    const r = await setup();
    r.navigateToTaskForm(null, { clientId: 'acme' });
    const depthAfterOpen = r.depth();

    r.navigateToTaskForm(null, { clientId: 'globex' });

    expect(r.depth()).toBe(depthAfterOpen);
  });

  it('separates the edit form from the new form', async () => {
    const r = await setup();
    r.navigateToTaskForm('t-1');

    expect(window.location.pathname).toBe('/app/task/t-1/edit');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'taskForm', taskId: 't-1' });
  });

  it('closes back onto whatever the form was opened from', async () => {
    const r = await setup();
    r.navigateToView('calendar');
    r.navigateToTaskForm(null, { clientId: 'acme' });

    r.closeTaskForm();

    expect(window.location.pathname).toBe('/app/calendar');
    expect(r.taskFormInstance().seed).toEqual({});
  });

  it('closes onto the task it just created', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTaskForm(null, { clientId: 'acme' });

    r.closeTaskFormOnto('t-new');

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-new' });
  });

  it('leaves no form entry behind, so Back off the new task returns to that view', async () => {
    const r = await setup();
    r.navigateToView('todos');
    r.navigateToTaskForm(null, { clientId: 'acme' });
    r.closeTaskFormOnto('t-new');

    window.history.back();

    expect(window.location.pathname).toBe('/app/todos');
    expect(r.taskFormInstance().seed).toEqual({});
  });

  it('routes to the new task when it closes back onto a task page', async () => {
    const r = await setup();
    // A subtask added from /app/task/<parent>: closing the form lands back on the
    // parent, and the new task has to take it from there rather than stay hidden.
    r.navigateToTask('t-parent');
    r.navigateToTaskForm(null, { parentId: 't-parent' });

    r.closeTaskFormOnto('t-child');

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-child' });
  });

  it('sends a form reached by URL alone straight to the new task', async () => {
    const r = await setup('/app/new');

    // Nothing of ours pushed this entry, so there is nothing to walk back off.
    r.closeTaskFormOnto('t-new');

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'task', taskId: 't-new' });
  });

  it('leaves a form reached by URL alone with an empty seed', async () => {
    const r = await setup();

    // Nothing pushed it: this is a pasted link or a reload, so there is no seed
    // and the form has to work the starting client out for itself.
    expect(r.taskFormInstance().seed).toEqual({});
    expect(r.taskFormInstance().key).toBe('0');
  });
});
