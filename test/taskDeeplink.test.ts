// Inbound task deeplinks (/app/new?title=…). Two things have to hold: the values
// are sanitized down to what the Markdown serializer can round-trip — they arrive
// from outside the app and end up in the user's repo — and the params are consumed
// on arrival, so a deeplink becomes an ordinary form seed and stops being part of
// the URL the router carries into every later route.

import { describe, it, expect, vi } from 'vitest';
import { parseTaskDeeplink } from '../src/ui/deeplink';

function seedFrom(query: string) {
  return parseTaskDeeplink(new URLSearchParams(query));
}

describe('parseTaskDeeplink', () => {
  it('reads the fields an extension would send', () => {
    expect(seedFrom('title=Fix+the+login+redirect&url=https%3A%2F%2Fgithub.com%2Facme%2Fweb%2Fissues%2F12&label=Issue+12&client=acme')).toEqual({
      title: 'Fix the login redirect',
      links: [{ url: 'https://github.com/acme/web/issues/12', label: 'Issue 12' }],
      clientId: 'acme',
    });
  });

  it('leaves a plain visit to the form alone', () => {
    expect(seedFrom('')).toBeNull();
    expect(seedFrom('owner=elio&repo=timesheet')).toBeNull();
  });

  it('reports params that sanitized down to nothing, so they still get stripped', () => {
    // Not null: something was there. Empty: none of it survived.
    expect(seedFrom('title=+++&url=javascript%3Aalert(1)')).toEqual({});
  });

  it('flattens a title to one line', () => {
    // A newline here would serialize as a second Markdown line under the `## `
    // heading — which is where a task's meta lines live.
    expect(seedFrom('title=Ship+it%0A-+id%3A+forged')?.title).toBe('Ship it - id: forged');
  });

  it('keeps only urls that are safe as an href', () => {
    expect(seedFrom('url=javascript%3Aalert(1)')?.links).toBeUndefined();
    expect(seedFrom('url=data%3Atext%2Fhtml%2C%3Cscript%3E')?.links).toBeUndefined();
    expect(seedFrom('url=not+a+url')?.links).toBeUndefined();
    expect(seedFrom('url=mailto%3Ame%40example.com')?.links).toEqual([{ url: 'mailto:me@example.com' }]);
  });

  it('encodes a space in a url, which would otherwise read as the start of the label', () => {
    // Serialized as `- link: <url> <label>`, so an unencoded space would split it.
    expect(seedFrom('url=https%3A%2F%2Fx.test%2Fa+b')?.links).toEqual([{ url: 'https://x.test/a%20b' }]);
  });

  it('keeps labels on their own links when one url is rejected', () => {
    const seed = seedFrom('url=javascript%3Aalert(1)&label=bad&url=https%3A%2F%2Fx.test&label=good');
    expect(seed?.links).toEqual([{ url: 'https://x.test/', label: 'good' }]);
  });

  it('takes tags comma-separated or repeated, deduped', () => {
    expect(seedFrom('tags=api%2C+billing+%2Capi')?.tags).toEqual(['api', 'billing']);
    expect(seedFrom('tags=api&tags=billing')?.tags).toEqual(['api', 'billing']);
  });

  it('drops a due date that is not one', () => {
    expect(seedFrom('due=2026-08-01')?.due).toBe('2026-08-01');
    expect(seedFrom('due=tomorrow')?.due).toBeUndefined();
    expect(seedFrom('due=01%2F08%2F2026')?.due).toBeUndefined();
  });

  it('keeps line breaks in the description but not the rest of the control range', () => {
    expect(seedFrom('description=first%0A%0Asecond%00third')?.description).toBe('first\n\nsecond third');
  });

  it('caps what a caller can push into a committed file', () => {
    const long = 'x'.repeat(1000);
    expect(seedFrom(`title=${long}`)?.title).toHaveLength(300);
    expect(seedFrom(`description=${'y'.repeat(9000)}`)?.description).toHaveLength(5000);
  });
});

interface Entry {
  url: string;
  state: unknown;
}

/** The slice of `window` the router touches, started at a given URL. */
function installWindow(startUrl: string) {
  const entries: Entry[] = [{ url: startUrl, state: null }];
  let index = 0;

  const win = {
    get location() {
      const [pathname, search] = entries[index].url.split('?');
      return { pathname, search: search ? `?${search}` : '', href: `https://x${entries[index].url}` };
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
        }
      },
    },
    addEventListener() {},
    removeEventListener() {},
  };

  (globalThis as { window?: unknown }).window = win;
  return { depth: () => entries.length, url: () => entries[index].url };
}

async function open(startUrl: string) {
  vi.resetModules();
  const win = installWindow(startUrl);
  // Importing the router is what consumes the deeplink — it happens once, on load,
  // before anything reads the route.
  const router = await import('../src/ui/router');
  return { ...win, ...router };
}

describe('deeplink arrival', () => {
  it('turns the query into the seed the form already knows how to start from', async () => {
    const r = await open('/app/new?title=Review+the+PR&client=acme');

    expect(r.parseRoute(window.location.pathname)).toEqual({ name: 'taskForm', taskId: null });
    expect(r.taskFormInstance().seed).toEqual({ title: 'Review the PR', clientId: 'acme' });
  });

  it('clears the params from the URL, keeping the ones that select the repo', async () => {
    const r = await open('/app/new?owner=elio&title=Review+the+PR&repo=timesheet');

    expect(r.url()).toBe('/app/new?owner=elio&repo=timesheet');
  });

  it('leaves no query behind when the deeplink was the whole of it', async () => {
    const r = await open('/app/new?title=Review+the+PR');

    expect(r.url()).toBe('/app/new');
  });

  it('replaces rather than pushes, so Back leaves the app the way the link found it', async () => {
    const r = await open('/app/new?title=Review+the+PR');

    expect(r.depth()).toBe(1);
  });

  it('closes to the dashboard, since the entry it sits on is not one we pushed', async () => {
    const r = await open('/app/new?title=Review+the+PR');

    r.closeTaskForm();

    expect(window.location.pathname).toBe('/app');
  });

  it('gives the form an instance key of its own, so it starts on the seeded values', async () => {
    const r = await open('/app/new?title=Review+the+PR');

    // '0' is the no-seed key a bare /app/new gets; a deeplink has to differ from it
    // or a form already open would not remount onto what arrived.
    expect(r.taskFormInstance().key).not.toBe('0');
  });

  it('ignores deeplink params on the edit form, which starts from the task', async () => {
    const r = await open('/app/task/t-1/edit?title=Not+this');

    expect(r.taskFormInstance().seed).toEqual({});
    expect(r.url()).toBe('/app/task/t-1/edit?title=Not+this');
  });

  it('does nothing to a plain /app/new', async () => {
    const r = await open('/app/new');

    expect(r.taskFormInstance().seed).toEqual({});
    expect(r.taskFormInstance().key).toBe('0');
  });
});
