// Keeps the installed app's icon badge in step with the model. Called once, by
// WorklogProvider — the badge belongs to the app, not to whichever view or route
// happens to be mounted, and the provider is the one thing spanning both.

import { useEffect, useMemo } from 'react';
import type { Task } from '../../model/types';
import { attentionCount, showAppBadge } from '../appBadge';

/**
 * Badge the icon with overdue + due-today while a repo is open.
 *
 * The cleanup carries as much weight as the effect: a badge outlives the page, so
 * switching repo or signing out has to take it down — otherwise the icon keeps
 * claiming work against a repo this device is no longer showing. It is two effects
 * rather than one with a cleanup, because clearing between every count change
 * would blink the badge off and on for nothing.
 *
 * Memoized on `tasks`/`today` and not the render: the provider re-renders on every
 * keystroke in UI state, and this walks the whole task list.
 */
export function useAppBadge(tasks: Task[], today: string): void {
  const count = useMemo(() => attentionCount(tasks, today), [tasks, today]);

  useEffect(() => {
    showAppBadge(count);
  }, [count]);

  useEffect(() => () => showAppBadge(0), []);
}
