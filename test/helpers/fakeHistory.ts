// The slice of `window` the router touches, backed by a real entry stack so
// back() behaves the way the app relies on.
//
// Hand-rolled rather than run under jsdom, for the reason `fakeIndexedDb.ts`
// gives: `npm test` keeps running with nothing installed. It is also the only way
// to assert on the stack itself — `depth()` and `at()` are what prove an entry was
// replaced rather than pushed, which is the difference between Back closing a task
// and Back stepping over it twice.

export interface Entry {
  url: string;
  state: unknown;
}

export interface FakeHistory {
  /** How many entries the stack holds. Back does not shrink it — the forward
   *  entry survives, the way it does in a browser — so this answers "was an entry
   *  pushed or replaced", not "where are we". */
  depth: () => number;
  /** The index the stack currently sits at. */
  at: () => number;
}

export interface FakeHistoryOptions {
  /** Deliver popstate on a microtask instead of inline, the way a browser does.
   *  Opt-in because most tests read the router's cached state straight after a
   *  back() and would have to await; it is what the "closing" guards — a second
   *  close arriving before the first has landed — need in order to be provable. */
  asyncPop?: boolean;
}

export function installWindow(initial = '/app', { asyncPop = false }: FakeHistoryOptions = {}): FakeHistory {
  const entries: Entry[] = [{ url: initial, state: null }];
  let index = 0;
  const popListeners: Array<() => void> = [];

  const win = {
    get location() {
      // Resolved rather than split, so a pushed path and a pushed absolute URL
      // both read back the same way.
      const url = new URL(entries[index].url, 'https://x');
      return { pathname: url.pathname, search: url.search, href: url.href };
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
          // Real popstate is async; firing it inline keeps the test readable, and
          // nothing but the "closing" guards depends on the delay.
          const fire = () => popListeners.forEach((l) => l());
          if (asyncPop) {
            queueMicrotask(fire);
          } else {
            fire();
          }
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
  return { depth: () => entries.length, at: () => index };
}
