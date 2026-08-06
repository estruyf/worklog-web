// The count on the installed app's icon: open tasks that are late, plus the ones
// landing today. Owned by WorklogProvider, which pushes a number through
// `useAppBadge` on every model change and takes the badge down on unmount.
//
// Nothing here scans or polls. The count is the same comparison the Overdue view
// and the nav badge already make, evaluated on the renders the UI is doing
// anyway — there is no service worker waking up to recount, and the badge is
// only ever as fresh as the last time the app was open. That is the whole trade:
// the icon becomes worth glancing at without any background state being written.
//
// Where it shows: installed Chromium apps (desktop dock/taskbar, Android
// launcher) and Safari 16.4+ web apps added to the Dock or Home Screen. A plain
// browser tab is not an install and Firefox has no `navigator.setAppBadge`, so
// both land in the no-op below and cost nothing.

import { isOverdue } from '../model/overdue';
import type { Task } from '../model/types';
import { dueOn, isDone } from './utils/task';

/**
 * What the badge counts: everything past its due date, plus what is due today.
 *
 * Same reckoning as the Overdue view, which shows those two as one page — and
 * counted the same way, so a recurring task that is both late and lands on today
 * is one task, not two. Judged against `today` rather than the day being browsed:
 * the icon says the same thing regardless of where the app was left.
 *
 * Returns 0 before the app knows what day it is, so an empty `today` can't badge
 * the icon with the entire backlog.
 */
export function attentionCount(tasks: Task[], today: string): number {
  if (!today) {
    return 0;
  }
  return tasks.filter((t) => isOverdue(t, today) || (!isDone(t) && dueOn(t, today))).length;
}

/**
 * Put `count` on the app icon, or clear it at zero.
 *
 * Fire-and-forget by design. Every way this can fail — no API, a tab that was
 * never installed, a platform that gates badging behind a permission the user
 * declined — rejects here, and none of them is something the app should tell the
 * user about or retry: the badge is a nicety layered over a UI that already shows
 * the same count in the nav rail.
 */
export function showAppBadge(count: number): void {
  if (typeof navigator === 'undefined' || typeof navigator.setAppBadge !== 'function') {
    return;
  }
  // `setAppBadge(0)` is specified to clear, but say so explicitly — the two calls
  // are the platform's own distinction between "none" and "nothing to show".
  const done = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  void done.catch(() => {});
}
