// Minimal client-side router for the /app island. Each top-level view is a route
// (day at /app, the rest at /app/<view>), and a single task opens as a shareable
// sub-route /app/task/<id> with a breadcrumb. The task form is a route too —
// /app/new and /app/task/<id>/edit — because a dialog tall enough to hold it
// gets cut off on short screens with nothing to scroll. Built on the History API
// so the browser's back/forward buttons just work.
//
// `navigate` wraps `history.pushState` and notifies subscribers; a `popstate`
// listener covers back/forward. Route helpers preserve the current query string
// (owner/repo/branch), which selects the mounted repo.
//
// /app/new doubles as the app's inbound deeplink: an extension or bookmarklet can
// open it with the task's fields in the query string, and `consumeTaskDeeplink`
// normalizes those into the same seed an in-app open uses. See ./deeplink.
//
// The dashboard's task detail panel is an overlay rather than a route — it covers
// the app without changing the URL — so it gets a history entry of its own here
// too (a same-URL entry tagged with the task id). Without one, Back would move
// the app underneath the panel while the panel itself stayed put on top.

import { useSyncExternalStore } from 'react';
import { DEEPLINK_PARAMS, parseTaskDeeplink } from './deeplink';
import type { AppView } from './model';
import type { TaskLink } from '../model/types';

const APP_BASE = '/app';

// The routable dashboard views. `day` lives at the base path; the rest hang off it.
const VIEWS: AppView[] = ['day', 'overdue', 'todos', 'calendar', 'clients', 'insights', 'archive', 'shortcuts', 'settings'];

export type Route =
  | { name: 'view'; view: AppView }
  | { name: 'task'; taskId: string }
  // The task form: `taskId` is the task being edited, or null for a new one.
  | { name: 'taskForm'; taskId: string | null }
  | { name: 'notFound' };

/** Route for a pathname. Exported for tests; the app reads `useRoute` instead. */
export function parseRoute(pathname: string): Route {
  // Trim the /app base, then match the task form, /task/<id> or /<view>;
  // anything else is 404.
  const rest = pathname.startsWith(APP_BASE) ? pathname.slice(APP_BASE.length) : pathname;
  if (rest === '/new' || rest === '/new/') {
    return { name: 'taskForm', taskId: null };
  }
  const edit = /^\/task\/([^/]+)\/edit\/?$/.exec(rest);
  if (edit) {
    return { name: 'taskForm', taskId: decodeURIComponent(edit[1]) };
  }
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
// Marks a history entry this app pushed for the task form, so closing the form
// can walk back off it instead of stranding the user on an unrelated page.
const FORM_KEY = 'worklogForm';
// What a *new* task form should start from — which client, whose subtask, which
// due date. None of it belongs in the URL (it's a starting point, not an
// address), and it can't be derived from one either: /app/new is the same path
// whether you arrived from the calendar, a parent task or the to-do list.
// (A deeplink from outside the app has no history to push and so must arrive in
// the query string; `consumeTaskDeeplink` moves it in here and clears the URL,
// which is what keeps this the only place a seed is ever read from.)
const FORM_SEED_KEY = 'worklogFormSeed';
// Distinguishes one visit to the form from the next. The path alone can't:
// opening the form from two different parents is twice /app/new, and the fields
// have to start over the second time. Kept in history state so back/forward
// return to the instance that entry was showing rather than minting a new one.
const FORM_SEQ_KEY = 'worklogFormSeq';

/** Where a new task form starts. Empty for a plain "new task".
 *
 *  In-app opens seed the first three: which client, whose subtask, which due date.
 *  The rest only ever come from an inbound deeplink (`./deeplink`), which has an
 *  actual task to hand over rather than a place to start from. */
export interface TaskFormSeed {
  clientId?: string;
  parentId?: string;
  due?: string;
  title?: string;
  links?: TaskLink[];
  tags?: string[];
  description?: string;
}

/** One visit to the task form: what it starts from, and an identity that changes
 *  whenever it should start over. */
export interface TaskFormInstance {
  seed: TaskFormSeed;
  key: string;
}

function readDetailState(): string | null {
  const state = window.history.state as Record<string, unknown> | null;
  const id = state?.[DETAIL_KEY];
  return typeof id === 'string' ? id : null;
}

function readFormInstance(): TaskFormInstance {
  const state = window.history.state as Record<string, unknown> | null;
  const seed = state?.[FORM_SEED_KEY];
  const seq = state?.[FORM_SEQ_KEY];
  return {
    seed: seed && typeof seed === 'object' ? (seed as TaskFormSeed) : {},
    key: typeof seq === 'number' ? String(seq) : '0',
  };
}

// Counts the form openings this session, so each gets its own instance key.
// Restarts at 0 on reload, which is harmless: a reloaded entry keeps the seq it
// was stored with, and nothing compares keys across page loads.
let formSeq = 0;

/** Turn an inbound deeplink into the ordinary seed, once, on arrival.
 *
 *  Everything downstream then reads a seed the way it always has — a deeplink is
 *  an entry format, not a second mechanism. Stripping the params matters as much
 *  as reading them: `navigate` carries the current query string into every later
 *  route (it's what keeps the mounted repo selected), so a `?title=` left in place
 *  would still be hanging off the URL three views on.
 *
 *  No FORM_KEY on the entry: this one wasn't pushed by us, so closing the form has
 *  nothing of ours to walk back off and should land on the dashboard instead of
 *  leaving the app entirely. */
function consumeTaskDeeplink(): void {
  const route = parseRoute(window.location.pathname);
  // Only the new-task form. An edit URL starts from the task's own values, so a
  // deeplink there has nothing to say.
  if (route.name !== 'taskForm' || route.taskId !== null) {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const seed = parseTaskDeeplink(params);
  if (!seed) {
    return;
  }
  for (const key of DEEPLINK_PARAMS) {
    params.delete(key);
  }
  const query = params.toString();
  window.history.replaceState(
    { [FORM_SEED_KEY]: seed, [FORM_SEQ_KEY]: ++formSeq },
    '',
    window.location.pathname + (query ? `?${query}` : ''),
  );
}

// Before the snapshots below are taken: they read what the deeplink has just
// written into history state.
if (typeof window !== 'undefined') {
  consumeTaskDeeplink();
}

// Cache the current route object so useSyncExternalStore gets a stable reference
// until the location actually changes.
let current: Route = typeof window === 'undefined' ? { name: 'view', view: 'day' } : parseRoute(window.location.pathname);
let overlayDetailId: string | null = typeof window === 'undefined' ? null : readDetailState();
const EMPTY_FORM_INSTANCE: TaskFormInstance = { seed: {}, key: '0' };
// Cached for the same reason as `current`: useSyncExternalStore compares by
// identity, so this must not be rebuilt per read.
let formInstance: TaskFormInstance = typeof window === 'undefined' ? EMPTY_FORM_INSTANCE : readFormInstance();
// `history.back()` only lands on the next popstate, so the overlay still reads as
// open until then. This keeps a second close request in that window (a delete
// closes the panel from two places) from popping one entry too many.
let closingDetail = false;
// Same for the task form: `history.back()` only lands on the next popstate, so a
// second close request in that window must not pop an extra entry (saving and
// deleting both close the form on their way out).
let closingForm = false;

function refresh(): void {
  current = parseRoute(window.location.pathname);
  overlayDetailId = readDetailState();
  formInstance = readFormInstance();
  closingDetail = false;
  closingForm = false;
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

/** Open the task form: /app/new for a new task, /app/task/<id>/edit for an
 *  existing one. Always pushes (never replaces the detail overlay's entry the
 *  way `navigate` does) so Back off the form lands on the panel you opened it
 *  from, panel included. `seed` is what a new form starts from — the form reads
 *  it once on mount and owns its fields from there. */
export function navigateToTaskForm(taskId?: string | null, seed: TaskFormSeed = {}): void {
  const path = taskId ? `${APP_BASE}/task/${encodeURIComponent(taskId)}/edit` : `${APP_BASE}/new`;
  const url = path + window.location.search;
  const state = { [FORM_KEY]: true, [FORM_SEED_KEY]: seed, [FORM_SEQ_KEY]: ++formSeq };
  // Re-opening the form you're already on (the sidebar's New task button stays
  // clickable) reseeds it in place rather than stacking a second entry that Back
  // would have to walk off twice. The new seq is what makes it *re*-seed: same
  // path, new instance, so the form starts over instead of keeping what was typed.
  if (window.location.pathname === path) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
  refresh();
}

/** Leave the task form. Walks back off the entry the form pushed, so closing it
 *  in-app and closing it with Back leave the same history behind; a form opened
 *  by a pasted URL has no such entry, so that one falls back to the dashboard. */
export function closeTaskForm(): void {
  if (closingForm) {
    return;
  }
  const state = window.history.state as Record<string, unknown> | null;
  closingForm = true;
  if (state?.[FORM_KEY]) {
    window.history.back();
  } else {
    navigate(APP_BASE);
  }
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

/** The open form's instance. Exported for tests; components use the hook below. */
export function taskFormInstance(): TaskFormInstance {
  return formInstance;
}

/** What the open task form starts from, and the identity that says when it should
 *  start over. Mount the form under `key={…instance.key}` so React remounts it —
 *  that remount *is* the reset; nothing has to clear the fields by hand. */
export function useTaskFormInstance(): TaskFormInstance {
  return useSyncExternalStore(subscribe, taskFormInstance, () => EMPTY_FORM_INSTANCE);
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
