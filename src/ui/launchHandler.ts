// Receiving an OS-level launch of the installed app: a manifest shortcut (the
// dock/taskbar right-click menu), a `web+worklog:` link the browser handed over, or
// the app icon itself. Owned by WebApp, which registers the consumer once on mount.
//
// The default is one new app window per launch. `launch_handler` in
// public/manifest.webmanifest asks for `focus-existing` instead, and that trade is
// the point of this module: the browser focuses the open window and delivers the
// target URL here rather than navigating to it, so a shortcut click no longer
// remounts the island — the mounted repo, the in-memory FileMap and a debounced
// commit that hasn't fired yet all survive. The other half of that bargain is that
// `focus-existing` is inert without a consumer: with no `setConsumer` call, clicking
// "Calendar" would focus the window and do nothing at all.
//
// Where the target goes is `./router`'s business (`navigateToLaunchTarget`); this
// module only takes delivery. Cold starts don't come through here at all — there is
// no window to focus, so the browser navigates to the target and the app boots on it
// the way it always has.
//
// Chromium-only. Safari and Firefox ignore `launch_handler` and have no
// `launchQueue`, so they keep the new-window behaviour and this quietly does nothing.

import { navigateToLaunchTarget } from './router';

/** Not in lib.dom — the Launch Handler API is a Chromium-only spec. Narrowed to
 *  what is read: `files` (the file-handler half) is not something this app claims. */
interface LaunchParams {
  targetURL?: string | null;
}

interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/** Take delivery of launches for the lifetime of this window.
 *
 *  Safe to call after mount despite a launch racing it: the queue buffers the
 *  pending params and replays them into the consumer the moment one is set. Call it
 *  once — a second `setConsumer` replaces the first, it doesn't stack. */
export function consumeLaunches(): void {
  const queue = (window as Window & { launchQueue?: LaunchQueue }).launchQueue;
  if (!queue) {
    return;
  }
  queue.setConsumer((params) => {
    if (params.targetURL) {
      navigateToLaunchTarget(params.targetURL);
    }
  });
}
