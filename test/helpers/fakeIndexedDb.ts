// A minimal in-memory IndexedDB for the offline tests.
//
// Only the surface `src/data/idb.ts` actually uses: open with an upgrade, one
// transaction at a time, and put/get/getAll/delete/clear over keyPath stores.
// Hand-rolled rather than pulled in as a dependency so `npm test` keeps running
// with no network and nothing to install — the same reason the suite reads a
// fixture repo instead of talking to GitHub.
//
// Callbacks fire on microtasks, never timers: the sync tests run under
// `vi.useFakeTimers()`, and a fake that needed the clock advanced would deadlock
// every `await` that goes through storage.

interface FakeStore {
  keyPath: string;
  rows: Map<string, unknown>;
}

interface FakeDbState {
  version: number;
  stores: Map<string, FakeStore>;
}

/** Installs the fake as `globalThis.indexedDB` and returns a reset for it. The
 *  data outlives a `vi.resetModules()`, which is the point: that is how a test
 *  simulates closing the app and opening it again on the same device. */
export function installFakeIndexedDb(): { reset: () => void } {
  const state: FakeDbState = { version: 0, stores: new Map() };

  function makeRequest<T>(run: () => T) {
    const req: { result: T | undefined; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
      result: undefined,
      onsuccess: null,
      onerror: null,
    };
    queueMicrotask(() => {
      req.result = run();
      req.onsuccess?.();
    });
    return req;
  }

  function objectStore(name: string) {
    const store = state.stores.get(name)!;
    const keyOf = (value: unknown) => String((value as Record<string, unknown>)[store.keyPath]);
    return {
      put: (value: unknown) => makeRequest(() => void store.rows.set(keyOf(value), structuredClone(value))),
      get: (key: string) => makeRequest(() => structuredClone(store.rows.get(key))),
      getAll: () => makeRequest(() => structuredClone([...store.rows.values()])),
      delete: (key: string) => makeRequest(() => void store.rows.delete(key)),
      clear: () => makeRequest(() => void store.rows.clear()),
    };
  }

  function makeDb() {
    return {
      objectStoreNames: { contains: (name: string) => state.stores.has(name) },
      createObjectStore: (name: string, opts: { keyPath: string }) => {
        state.stores.set(name, { keyPath: opts.keyPath, rows: new Map() });
      },
      transaction: (_name: string, _mode: string) => {
        const tx: { oncomplete: (() => void) | null; onerror: (() => void) | null; onabort: (() => void) | null; objectStore: (n: string) => unknown } = {
          oncomplete: null,
          onerror: null,
          onabort: null,
          objectStore,
        };
        // Two hops: the first lets the request callbacks queued by the caller's
        // `body()` run, the second reports the transaction as complete after them.
        queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
        return tx;
      },
      close: () => {},
    };
  }

  const indexedDB = {
    open: (_name: string, version: number) => {
      const req: {
        result: ReturnType<typeof makeDb> | undefined;
        onupgradeneeded: (() => void) | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        onblocked: (() => void) | null;
      } = { result: undefined, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        req.result = makeDb();
        if (version > state.version) {
          state.version = version;
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    },
  };

  globalThis.indexedDB = indexedDB as unknown as IDBFactory;
  return {
    reset: () => {
      state.version = 0;
      state.stores.clear();
    },
  };
}

/** A stand-in for `window` that only carries the connectivity events the store
 *  listens for, plus a way to fire them. */
export function installFakeWindow(): { dispatch: (type: 'online' | 'offline') => void; reset: () => void } {
  const listeners = new Map<string, Set<() => void>>();
  const fakeWindow = {
    addEventListener: (type: string, fn: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
  };
  (globalThis as Record<string, unknown>).window = fakeWindow;
  return {
    dispatch: (type) => {
      for (const fn of listeners.get(type) ?? []) {
        fn();
      }
    },
    reset: () => listeners.clear(),
  };
}

/** Point `navigator.onLine` at a switch the test can flip. */
export function installFakeNavigator(): { setOnline: (online: boolean) => void } {
  const nav = { onLine: true };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  return { setOnline: (online: boolean) => (nav.onLine = online) };
}
