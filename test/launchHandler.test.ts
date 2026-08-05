// Launching the installed app while a window is already open. The manifest asks for
// `focus-existing`, so the browser hands the target URL to the page instead of
// navigating to it — which means the router, not a page load, has to end up showing
// the right thing. What has to hold: the mounted repo (the query string) survives,
// the new-task shortcut starts a *fresh* form, a `web+worklog:` link seeds it, and
// re-launching the view you are already on doesn't pile up history entries.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface Entry {
  url: string;
  state: unknown;
}

/** The slice of `window` the router touches, backed by a real entry stack. Same
 *  shape as test/taskFormRoute.test.ts, plus the `location.assign` this path can
 *  reach for when a target falls outside the /app island. */
function installWindow(initial = '/app?owner=me&repo=timesheet') {
  const entries: Entry[] = [{ url: initial, state: null }];
  let index = 0;
  const popListeners: Array<() => void> = [];
  const assigned: string[] = [];

  const win = {
    get location() {
      const [pathname, search] = entries[index].url.split('?');
      return {
        pathname,
        search: search ? `?${search}` : '',
        href: `https://x${entries[index].url}`,
        origin: 'https://x',
        assign: (url: string) => assigned.push(url),
      };
    },
    history: {
      get state() {
        return entries[index].state;
      },
      pushState(state: unknown, _title: string, url: string) {
        entries.length = index + 1;
        entries.push({ url, state });
        index++;
      },
      replaceState(state: unknown, _title: string, url: string) {
        entries[index] = { url, state };
      },
      back() {
        if (index > 0) {
          index--;
          popListeners.forEach((l) => l());
        }
      },
    },
    addEventListener(type: string, listener: () => void) {
      if (type === 'popstate') {
        popListeners.push(listener);
      }
    },
    removeEventListener() {},
  };

  (globalThis as { window?: unknown }).window = win;
  return { depth: () => entries.length, url: () => entries[index].url, assigned: () => assigned };
}

async function setup(initial?: string) {
  vi.resetModules();
  const win = installWindow(initial);
  const router = await import('../src/ui/router');
  return { ...win, ...router };
}

describe('launch targets', () => {
  it('keeps the mounted repo when a shortcut names only a path', async () => {
    const r = await setup();

    r.navigateToLaunchTarget('/app/calendar');

    // The dock knows nothing about which repo is open, so the query has to carry
    // over from the window being focused rather than from the launch.
    expect(r.url()).toBe('/app/calendar?owner=me&repo=timesheet');
    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'view', view: 'calendar' });
  });

  it('does nothing when the target is the view already showing', async () => {
    const r = await setup('/app/todos');
    const before = r.depth();

    r.navigateToLaunchTarget('/app/todos');

    // Focusing the window was the whole request; an extra entry would only give
    // Back nothing to do.
    expect(r.depth()).toBe(before);
    expect(r.url()).toBe('/app/todos');
  });

  it('starts the new-task form over, even sitting on a half-typed one', async () => {
    const r = await setup();
    r.navigateToTaskForm(null, { clientId: 'acme' });
    const first = r.taskFormInstance().key;

    r.navigateToLaunchTarget('/app/new');

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'taskForm', taskId: null });
    expect(r.taskFormInstance().key).not.toBe(first);
    expect(r.taskFormInstance().seed).toEqual({});
  });

  it('closes the launched form back onto the view the launch interrupted', async () => {
    const r = await setup();
    r.navigateToView('calendar');

    r.navigateToLaunchTarget('/app/new');
    r.closeTaskForm();

    expect(window.location.pathname).toBe('/app/calendar');
  });

  it('seeds the form from a handed-over web+worklog: link', async () => {
    const r = await setup();
    const scheme = encodeURIComponent('web+worklog://new?title=Ship%20the%20release&tags=release');

    r.navigateToLaunchTarget(`/app/new?handler=${scheme}`);

    expect(r.taskFormInstance().seed).toEqual({ title: 'Ship the release', tags: ['release'] });
    // The deeplink params are the launch's, not the window's: leaving them on the
    // URL would let `navigate` carry them into every later route.
    expect(r.url()).toBe('/app/new?owner=me&repo=timesheet');
  });

  it('falls back to a real navigation for a target outside the island', async () => {
    const r = await setup();

    r.navigateToLaunchTarget('/');

    // The marketing page is not a route the client router can serve.
    expect(r.assigned()).toEqual(['https://x/']);
    expect(r.url()).toBe('/app?owner=me&repo=timesheet');
  });

  it('ignores a cross-origin target', async () => {
    const r = await setup();

    r.navigateToLaunchTarget('https://elsewhere.example/app/calendar');

    expect(r.assigned()).toEqual([]);
    expect(r.url()).toBe('/app?owner=me&repo=timesheet');
  });

  it('is asked for by the manifest — without this the consumer is never called', async () => {
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf-8'));

    expect(manifest.launch_handler).toEqual({ client_mode: 'focus-existing' });
  });
});
