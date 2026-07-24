// Minimal client-side router for the /app island. Each top-level view is a route
// (day at /app, the rest at /app/<view>), and a single task opens as a shareable
// sub-route /app/task/<id> with a breadcrumb. Built on the History API so the
// browser's back/forward buttons just work.
//
// `navigate` wraps `history.pushState` and notifies subscribers; a `popstate`
// listener covers back/forward. Route helpers preserve the current query string
// (owner/repo/branch), which selects the mounted repo.

import { useSyncExternalStore } from 'react';
import type { AppView } from './model';

const APP_BASE = '/app';

// The routable dashboard views. `day` lives at the base path; the rest hang off it.
const VIEWS: AppView[] = ['day', 'calendar', 'clients', 'insights', 'archive', 'settings'];

export type Route =
  | { name: 'view'; view: AppView }
  | { name: 'task'; taskId: string }
  | { name: 'notFound' };

function parse(pathname: string): Route {
  // Trim the /app base, then match /task/<id> or /<view>; anything else is 404.
  const rest = pathname.startsWith(APP_BASE) ? pathname.slice(APP_BASE.length) : pathname;
  const task = /^\/task\/([^/]+)\/?$/.exec(rest);
  if (task) {
    return { name: 'task', taskId: decodeURIComponent(task[1]) };
  }
  if (rest === '' || rest === '/') {
    return { name: 'view', view: 'day' };
  }
  const segment = rest.replace(/^\/|\/$/g, '');
  const view = VIEWS.find((v) => v === segment);
  return view ? { name: 'view', view } : { name: 'notFound' };
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    l();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cache the current route object so useSyncExternalStore gets a stable reference
// until the location actually changes.
let current: Route = typeof window === 'undefined' ? { name: 'view', view: 'day' } : parse(window.location.pathname);

function refresh(): void {
  current = parse(window.location.pathname);
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', refresh);
}

/** Push a new path (keeping the current query string) and re-render routed views. */
function navigate(path: string): void {
  const url = path + window.location.search;
  window.history.pushState({}, '', url);
  refresh();
}

/** Path for a dashboard view (day is the base path). */
function viewPath(view: AppView): string {
  return view === 'day' ? APP_BASE : `${APP_BASE}/${view}`;
}

export function navigateToView(view: AppView): void {
  navigate(viewPath(view));
}

export function navigateToTask(taskId: string): void {
  navigate(`${APP_BASE}/task/${encodeURIComponent(taskId)}`);
}

export function navigateToDashboard(): void {
  navigate(APP_BASE);
}

/** Subscribe to the active route. */
export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
