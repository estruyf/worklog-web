// Minimal client-side router for the /app island. Each top-level view is a route
// (day at /app, the rest at /app/<view>), and a single task opens as a shareable
// sub-route /app/task/<id> with a breadcrumb. Built on the History API so the
// browser's back/forward buttons just work.
//
// `navigate` wraps `history.pushState` and notifies subscribers; a `popstate`
// listener covers back/forward. Route helpers preserve the current query string
// (owner/repo/branch), which selects the mounted repo.
//
// The dashboard's task detail panel is an overlay rather than a route — it covers
// the app without changing the URL — so it gets a history entry of its own here
// too (a same-URL entry tagged with the task id). Without one, Back would move
// the app underneath the panel while the panel itself stayed put on top.

import { useSyncExternalStore } from 'react';
import type { AppView } from './model';

const APP_BASE = '/app';

// The routable dashboard views. `day` lives at the base path; the rest hang off it.
const VIEWS: AppView[] = ['day', 'todos', 'calendar', 'clients', 'insights', 'archive', 'settings'];

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

// The history-state key holding the task the detail overlay is open on.
const DETAIL_KEY = 'worklogDetail';

function readDetailState(): string | null {
  const state = window.history.state as Record<string, unknown> | null;
  const id = state?.[DETAIL_KEY];
  return typeof id === 'string' ? id : null;
}

// Cache the current route object so useSyncExternalStore gets a stable reference
// until the location actually changes.
let current: Route = typeof window === 'undefined' ? { name: 'view', view: 'day' } : parse(window.location.pathname);
let overlayDetailId: string | null = typeof window === 'undefined' ? null : readDetailState();
// `history.back()` only lands on the next popstate, so the overlay still reads as
// open until then. This keeps a second close request in that window (a delete
// closes the panel from two places) from popping one entry too many.
let closingDetail = false;

function refresh(): void {
  current = parse(window.location.pathname);
  overlayDetailId = readDetailState();
  closingDetail = false;
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', refresh);
}

/** Push a new path (keeping the current query string) and re-render routed views.
 *  Navigating while the detail overlay is open replaces its entry instead of
 *  stacking on top of it, so Back from the new view can't resurrect a panel the
 *  user has already left. */
function navigate(path: string): void {
  const url = path + window.location.search;
  if (overlayDetailId) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
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

/** Open the dashboard's task detail overlay. Adds a same-URL history entry so the
 *  browser's Back button (and the phone's swipe / system back) closes the panel;
 *  opening a subtask from within it stacks, so Back walks back up the chain. */
export function openTaskDetail(taskId: string): void {
  if (overlayDetailId === taskId) {
    return;
  }
  window.history.pushState({ [DETAIL_KEY]: taskId }, '', window.location.href);
  refresh();
}

/** Close the detail overlay by walking back off the entry it pushed, so closing
 *  it in-app and closing it with Back leave the same history behind. No-op when
 *  no overlay entry is on the stack (e.g. on the routed /app/task/<id> page). */
export function closeTaskDetail(): void {
  if (overlayDetailId && !closingDetail) {
    closingDetail = true;
    window.history.back();
  }
}

/** Subscribe to the active route. */
export function useRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/** The task the detail view is pinned to: on /app/task/<id> the route's own task,
 *  everywhere else whatever the overlay was opened with. */
export function useDetailId(): string | null {
  const route = useRoute();
  const overlay = useSyncExternalStore(
    subscribe,
    () => overlayDetailId,
    () => null,
  );
  return route.name === 'task' ? route.taskId : overlay;
}
