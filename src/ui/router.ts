// Minimal client-side router for the /app island. Each top-level view is a route
// (day at /app, the rest at /app/<view>), and a single task is a route of its own
// at /app/task/<id>. The task form is a route too — /app/new and
// /app/task/<id>/edit — because a dialog tall enough to hold it gets cut off on
// short screens with nothing to scroll. Built on the History API so the browser's
// back/forward buttons just work.
//
// `navigate` wraps `history.pushState` and notifies subscribers; a `popstate`
// listener covers back/forward. Route helpers preserve the current query string
// (owner/repo/branch), which selects the mounted repo.
//
// /app/new doubles as the app's inbound deeplink: an extension or bookmarklet can
// open it with the task's fields in the query string, and `consumeTaskDeeplink`
// normalizes those into the same seed an in-app open uses. See ./deeplink.
//
// Opening a task used to be an overlay on a same-URL history entry: it covered the
// app without changing the address, so the task you were looking at had no link to
// give anyone. Every open is a real navigation now, and the address bar is the
// share affordance. What the overlay got right is kept — Back closes the task, and
// a subtask opened from within one stacks, so Back walks back up the chain — but it
// falls out of ordinary history rather than out of a parallel mechanism.

import { useSyncExternalStore } from 'react';
import { DEEPLINK_PARAMS, parseTaskDeeplink } from './deeplink';
import type { AppView } from './model';
import type { TaskLink } from '../model/types';

const APP_BASE = '/app';

// The routable dashboard views. `day` lives at the base path; the rest hang off it.
const VIEWS: AppView[] = ['day', 'overdue', 'upcoming', 'todos', 'lists', 'calendar', 'clients', 'insights', 'archive', 'shortcuts', 'settings'];

export type Route =
  // `listId` is the one view whose *inside* is addressable: a checklist is a
  // thing you work down over an afternoon, reload, and send someone. It stays a
  // view rather than a route of its own because that is what it is — the Lists
  // view with one of them open, nav rail and all.
  | { name: 'view'; view: AppView; listId?: string }
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
  const list = /^\/lists\/([^/]+)\/?$/.exec(rest);
  if (list) {
    return { name: 'view', view: 'lists', listId: decodeURIComponent(list[1]) };
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

// Marks a history entry this app pushed for a task, so closing the task can walk
// back off it onto whatever it was opened from — the calendar you were browsing,
// the parent task — instead of guessing a destination. A task reached by a pasted
// or shared link has no such entry, which is exactly the difference that matters.
const TASK_KEY = 'worklogTask';
// The task an entry was opened *from*, when that was another task. It is what lets
// the way back out of a subtask land on its parent without pushing a second copy
// of the parent on top of the chain — see `navigateBackToTask`.
const FROM_KEY = 'worklogTaskFrom';
// Marks a history entry this app pushed for an open list, the same way and for
// the same reason as TASK_KEY: leaving the list walks back off it, so closing it
// in-app and closing it with Back leave the same history behind. A list arrived
// at by a shared link has no entry of ours and falls back to the board.
const LIST_KEY = 'worklogList';
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
  /** A canonical priority id. A deeplink's value is checked against the scale
   *  before it gets here — see `parseTaskDeeplink`. */
  priority?: string;
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

function readFormInstance(): TaskFormInstance {
  const state = window.history.state as Record<string, unknown> | null;
  const seed = state?.[FORM_SEED_KEY];
  const seq = state?.[FORM_SEQ_KEY];
  return {
    seed: seed && typeof seed === 'object' ? (seed as TaskFormSeed) : {},
    key: typeof seq === 'number' ? String(seq) : '0',
  };
}

function readOpenedFrom(): string | null {
  const from = (window.history.state as Record<string, unknown> | null)?.[FROM_KEY];
  return typeof from === 'string' ? from : null;
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

/** Send `/app/task` with no id to the dashboard.
 *
 *  It addresses no task — a shared link truncated at the last slash, or one typed
 *  by hand — and the dashboard is the only thing it can reasonably mean. Now that
 *  every task is a URL people copy and paste, that truncation is a normal way to
 *  arrive, and a 404 is a poor answer to a link that is only missing its last
 *  segment.
 *
 *  Replaces rather than pushes, and keeps the query string that selects the mounted
 *  repo: a pushed entry would leave Back pointing at a URL that immediately
 *  redirects again, which reads as Back being broken. */
function redirectBareTaskPath(): void {
  const rest = window.location.pathname.startsWith(APP_BASE)
    ? window.location.pathname.slice(APP_BASE.length)
    : window.location.pathname;
  if (rest !== '/task' && rest !== '/task/') {
    return;
  }
  window.history.replaceState({}, '', APP_BASE + window.location.search);
}

// Before the snapshots below are taken: they read the path the redirect leaves
// behind and what the deeplink has written into history state.
if (typeof window !== 'undefined') {
  redirectBareTaskPath();
  consumeTaskDeeplink();
}

// Cache the current route object so useSyncExternalStore gets a stable reference
// until the location actually changes.
let current: Route = typeof window === 'undefined' ? { name: 'view', view: 'day' } : parseRoute(window.location.pathname);
const EMPTY_FORM_INSTANCE: TaskFormInstance = { seed: {}, key: '0' };
// Cached for the same reason as `current`: useSyncExternalStore compares by
// identity, so this must not be rebuilt per read.
let formInstance: TaskFormInstance = typeof window === 'undefined' ? EMPTY_FORM_INSTANCE : readFormInstance();
// The task the entry we are on was opened from, read out of history state so it
// survives a reload and a walk back through the chain.
let openedFrom: string | null = typeof window === 'undefined' ? null : readOpenedFrom();
// `history.back()` only lands on the next popstate, so the task still reads as
// open until then. This keeps a second close request in that window (deleting a
// task closes it from two places) from popping one entry too many.
let closingTask = false;
// Same for the task form: `history.back()` only lands on the next popstate, so a
// second close request in that window must not pop an extra entry (saving and
// deleting both close the form on their way out).
let closingForm = false;
// Same again for an open list: Escape held down would otherwise pop one entry
// per repeat while the first `history.back()` is still landing.
let closingList = false;
// A task to show once the form's `history.back()` has landed — see
// `closeTaskFormOnto`. Held here rather than passed along because the landing is
// a popstate, and popstate carries nothing of ours.
let showAfterFormClose: string | null = null;

function refresh(): void {
  // Here as well as on arrival, so no route is ever read from a bare task path —
  // a launch target or a protocol link can hand one over mid-session.
  redirectBareTaskPath();
  current = parseRoute(window.location.pathname);
  formInstance = readFormInstance();
  openedFrom = readOpenedFrom();
  closingTask = false;
  closingForm = false;
  closingList = false;
  const pending = showAfterFormClose;
  showAfterFormClose = null;
  notify();
  if (pending) {
    navigateToTask(pending);
  }
}

// ---- navigation guard -------------------------------------------------------
// A view holding an unsaved draft (Settings) registers a guard: a callback that
// asks the user and resolves true when leaving is allowed. Every route change
// consults it — the nav rail, the shortcuts, back/forward — so the draft can't
// be discarded by a navigation the guard never saw. One slot, not a set: only
// one view is on screen to have a draft.

type NavGuard = () => Promise<boolean>;
let navGuard: NavGuard | null = null;
// Set just before the guard itself walks history back, so the popstate that
// lands isn't intercepted again by the very guard that approved it.
let leaveApproved = false;

/** Register (or clear, with null) the current view's leave guard. */
export function setNavGuard(guard: NavGuard | null): void {
  navGuard = guard;
}

/** Whether navigation may proceed. Exported for the leave paths that bypass the
 *  router entirely — switching repo, signing out — which unmount the view and
 *  its draft just as surely as a route change does. */
export function confirmNavGuard(): Promise<boolean> {
  return navGuard ? navGuard() : Promise.resolve(true);
}

/** Run `go` now, or after the guard allows it. Same-path navigation skips the
 *  guard: re-entering the view you are on abandons nothing. */
function guarded(destinationPath: string, go: () => void): void {
  if (!navGuard || destinationPath === window.location.pathname) {
    go();
    return;
  }
  void confirmNavGuard().then((ok) => {
    if (ok) {
      go();
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    // Back/forward has already moved the location by the time this fires, so a
    // held navigation is undone rather than prevented: put the guarded view's
    // entry back on top, ask, and only walk off it again on approval. Guards are
    // only ever registered on view routes; anything else passes through.
    if (navGuard && !leaveApproved && current.name === 'view') {
      window.history.pushState({}, '', viewPath(current.view) + window.location.search);
      void navGuard().then((ok) => {
        if (ok) {
          leaveApproved = true;
          window.history.back();
        }
      });
      return;
    }
    leaveApproved = false;
    refresh();
  });
}

/** Push a new path (keeping the current query string) and re-render routed views. */
function navigate(path: string): void {
  guarded(path, () => {
    window.history.pushState({}, '', path + window.location.search);
    refresh();
  });
}

/** Path for a dashboard view (day is the base path). */
function viewPath(view: AppView): string {
  return view === 'day' ? APP_BASE : `${APP_BASE}/${view}`;
}

export function navigateToView(view: AppView): void {
  navigate(viewPath(view));
}

/** Open one list at its own URL, so it survives a reload and can be handed to
 *  someone. Re-opening the list you are already on replaces that entry rather
 *  than stacking a second one Back would have to step over twice — a duplicate
 *  and a search hit both open a list that may already be open. */
export function navigateToList(listId: string): void {
  const path = `${APP_BASE}/lists/${encodeURIComponent(listId)}`;
  guarded(path, () => {
    const url = path + window.location.search;
    if (window.location.pathname === path) {
      window.history.replaceState({ [LIST_KEY]: true }, '', url);
    } else {
      window.history.pushState({ [LIST_KEY]: true }, '', url);
    }
    refresh();
  });
}

/** Leave the open list for the board. A no-op when none is open: Escape reaches
 *  here from a view that may have nothing to close. */
export function closeList(): void {
  if (closingList || current.name !== 'view' || current.listId === undefined) {
    return;
  }
  const state = window.history.state as Record<string, unknown> | null;
  if (state?.[LIST_KEY]) {
    closingList = true;
    window.history.back();
  } else {
    navigate(viewPath('lists'));
  }
}

/** Swap a list URL that resolves to nothing for the board — the list was deleted,
 *  here or on another device, and the board is a page rather than an error. It
 *  replaces: a pushed entry would leave Back pointing at the same dead id. */
export function replaceWithLists(): void {
  window.history.replaceState({}, '', viewPath('lists') + window.location.search);
  refresh();
}

/** Open a task at its own URL. The entry is tagged as ours so `closeTask` can walk
 *  back off it; re-opening the task you are already on replaces that entry rather
 *  than stacking a second one Back would have to step over twice. */
export function navigateToTask(taskId: string): void {
  const path = `${APP_BASE}/task/${encodeURIComponent(taskId)}`;
  guarded(path, () => {
    const url = path + window.location.search;
    const previous = window.history.state as Record<string, unknown> | null;
    // Where this entry was opened from, when that was another task. A re-open in
    // place is not a move, so it keeps whatever the entry already recorded rather
    // than naming the task as its own origin.
    const from = current.name === 'task' && current.taskId !== taskId ? current.taskId : previous?.[FROM_KEY];
    const state = from ? { [TASK_KEY]: true, [FROM_KEY]: from } : { [TASK_KEY]: true };
    if (window.location.pathname === path) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }
    refresh();
  });
}

/** Go to a task as the way *back* — the parent of the subtask on screen.
 *
 *  Walks back off the current entry when that entry was opened from this very
 *  task, so working through a parent's subtasks one after another leaves the
 *  parent's single entry behind instead of a trail of parent/child/parent pushes
 *  that Back then has to step through. The header only offers the way back when
 *  that is the case (see `useOpenedFromTaskId`), so the push below is the contract
 *  holding rather than a path the UI takes: called with a task that is not behind
 *  us, this still goes there. */
export function navigateBackToTask(taskId: string): void {
  if (closingTask) {
    return;
  }
  const state = window.history.state as Record<string, unknown> | null;
  if (current.name === 'task' && state?.[TASK_KEY] && state?.[FROM_KEY] === taskId) {
    closingTask = true;
    window.history.back();
    return;
  }
  navigateToTask(taskId);
}

/** Leave the open task. Walks back off the entry opening it pushed, so closing it
 *  in-app and closing it with Back leave the same history behind — and land on the
 *  same place, whichever view or parent task it was opened from. A task reached by
 *  a shared link has no entry of ours to walk off, so that one falls back to the
 *  dashboard rather than leaving the app entirely.
 *
 *  A no-op when no task is open. Callers reach for this to mean "close whatever
 *  task is showing" from places where none need be — a tag chip on a task row does
 *  it from the middle of a view — and navigating them off that view would be a
 *  strange way to answer "there was nothing to close". */
export function closeTask(): void {
  if (closingTask || current.name !== 'task') {
    return;
  }
  const state = window.history.state as Record<string, unknown> | null;
  if (state?.[TASK_KEY]) {
    closingTask = true;
    window.history.back();
  } else {
    navigate(APP_BASE);
  }
}

export function navigateToDashboard(): void {
  navigate(APP_BASE);
}

/** Open the task form: /app/new for a new task, /app/task/<id>/edit for an
 *  existing one. `seed` is what a new form starts from — the form reads it once on
 *  mount and owns its fields from there. */
export function navigateToTaskForm(taskId?: string | null, seed: TaskFormSeed = {}): void {
  const path = taskId ? `${APP_BASE}/task/${encodeURIComponent(taskId)}/edit` : `${APP_BASE}/new`;
  guarded(path, () => {
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
  });
}

/** Enter a URL an installed-app launch handed over: a manifest shortcut, a
 *  `web+worklog:` link, the app icon itself. See ./launchHandler for who calls this.
 *
 *  A launch into an app that is *already open* is an instruction to show something,
 *  not a page load. Re-entering it through the ordinary navigation helpers is what
 *  keeps the mounted repo, the in-memory FileMap and any armed commit alive —
 *  assigning to `location` would tear the island down and rebuild all of it.
 *
 *  The target's own query is dropped once its deeplink params are read, because
 *  `navigate` carries the *current* one forward and that is what selects the mounted
 *  repo. A shortcut clicked from the dock knows nothing about which repo is open. */
export function navigateToLaunchTarget(target: string): void {
  let url: URL;
  try {
    url = new URL(target, window.location.href);
  } catch {
    return;
  }
  // Not ours to act on. The launch target is browser-supplied rather than
  // user-supplied, but this is a navigation taken without a click either way.
  if (url.origin !== window.location.origin) {
    return;
  }
  // The manifest scope is the whole origin, so a launch can legitimately point
  // outside the island (the marketing page, the sign-in landing). Only a real
  // navigation serves those — the client router has no route for them.
  if (url.pathname !== APP_BASE && !url.pathname.startsWith(`${APP_BASE}/`)) {
    window.location.assign(url.href);
    return;
  }
  const route = parseRoute(url.pathname);
  // The new-task form goes through its own opener even with nothing to seed: it is
  // the one route that must *start over* when re-entered, which is precisely what
  // the "New task" shortcut asks for on a window already sitting on a half-typed
  // form. The pushed entry is also what lets closing the form walk back to the view
  // the launch interrupted.
  if (route.name === 'taskForm' && route.taskId === null) {
    navigateToTaskForm(null, parseTaskDeeplink(url.searchParams) ?? {});
    return;
  }
  // Already here: focusing the window *was* the whole request, and a duplicate
  // entry would only give Back nothing to do.
  if (url.pathname === window.location.pathname) {
    return;
  }
  navigate(url.pathname);
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

/** Leave the task form onto the task it just created, instead of onto whatever
 *  the user was looking at before: a task you have only just described is the one
 *  thing you want in front of you, and the day view isn't it.
 *
 *  Walks back off the form's entry first, exactly the way closing it does, so the
 *  form leaves no trace in history and Back from the task lands where the form was
 *  opened from. Showing it can't happen until that back has *landed* — the entry
 *  is only gone on the next popstate, and pushing before then would put the task on
 *  top of the form and the back would take it straight off again. Hence the deferral
 *  through `refresh`.
 *
 *  A form reached by URL alone has no entry of ours to walk off (see
 *  `closeTaskForm`), so that one goes straight to the task's own page. */
export function closeTaskFormOnto(taskId: string): void {
  if (closingForm) {
    return;
  }
  const state = window.history.state as Record<string, unknown> | null;
  if (!state?.[FORM_KEY]) {
    navigateToTask(taskId);
    return;
  }
  closingForm = true;
  showAfterFormClose = taskId;
  window.history.back();
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

/** The task being shown, or null when the route isn't a task. The URL is the only
 *  place this lives — which is what makes the open task addressable. */
export function useDetailId(): string | null {
  const route = useRoute();
  return route.name === 'task' ? route.taskId : null;
}

/** The list being shown, or null when the Lists view is on its board. Like the
 *  open task, the URL is the only place this lives. */
export function useOpenListId(): string | null {
  const route = useRoute();
  return route.name === 'view' && route.view === 'lists' ? (route.listId ?? null) : null;
}

/** The task the entry we are on was opened from, or null. Exported for tests; the
 *  app reads the hook below. */
export function openedFromTaskId(): string | null {
  return openedFrom;
}

/** Which task the open one was reached from, when it was reached from one at all.
 *
 *  Deliberately not "does this task have a parent": the same subtask is opened
 *  from its parent, from the day it is due on, and from a shared link, and only
 *  the first of those has a parent behind it to go back to. It is history state
 *  rather than a URL segment because it describes the journey, not the task — the
 *  address stays the one thing you can copy and hand to someone. */
export function useOpenedFromTaskId(): string | null {
  return useSyncExternalStore(subscribe, openedFromTaskId, () => null);
}
