import React from 'react';
import { CloudOffIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '../primitives';
import { useData } from '../context';

/** A standing reminder that work hasn't reached GitHub, above the view.
 *
 *  The sidebar's Git sync button already carries this state, but it is one muted
 *  row in a rail that a phone hides behind a drawer — fine for "something is
 *  pending", not enough for "you have three days of hours on this laptop and
 *  nowhere else". So this says it in the content column, where it can't be
 *  missed, and stays until it stops being true.
 *
 *  It is deliberately not dismissible. A reminder you can wave away is one you
 *  will wave away, and the failure it guards against — closing the tab on the
 *  only copy of a week's timesheet — is not recoverable by being tidy.
 *
 *  Silent in the one case that doesn't need it: online, with automatic sync (by
 *  timer or by change event) about to send everything anyway. Nagging about work
 *  that is already on its way is how a banner teaches people to ignore banners. */
/** It is mounted above the view's scroll area rather than inside it, so it stays
 *  on screen without needing to be `sticky` at an offset that depends on what
 *  chrome happens to sit above it. */
export function SyncStatusBar() {
  const { offline, gitPending, pendingCount, autoSync, triggerGitSync } = useData();
  const willSyncItself = autoSync.enabled || autoSync.events.length > 0;

  if (!offline && (!gitPending || willSyncItself)) {
    return null;
  }

  const files = `${pendingCount} file${pendingCount === 1 ? '' : 's'}`;

  return (
    <div
      role="status"
      className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-brand-375 bg-brand-150 px-4 py-2 text-control text-brand-600"
    >
      {offline ? <CloudOffIcon size={15} className="shrink-0" /> : <RefreshCwIcon size={15} className="shrink-0" />}
      <span className="font-semibold text-brand-800">{offline ? 'Offline' : 'Not synced'}</span>
      <span>
        {offline
          ? gitPending
            ? willSyncItself
              ? `${files} with changes are saved on this device and will sync when you reconnect.`
              : `${files} with changes are saved on this device — remember to sync once you're back online.`
            : 'Showing the timesheet as it was last synced.'
          : `${files} have changes that aren't on GitHub yet.`}
      </span>
      {!offline && gitPending && (
        <Button variant="primary" size="xs" onClick={triggerGitSync} className="ml-auto shrink-0">
          Sync now
        </Button>
      )}
    </div>
  );
}
