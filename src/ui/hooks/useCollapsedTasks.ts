// Which things are folded shut in the task lists, remembered per repo across
// reloads. Two sets use it, told apart by their storage key: the parent tasks
// whose subtasks are folded, and the client cards collapsed in the grouped
// lists. Both are "ids the reader has closed", so they are one hook.
//
// localStorage, not the repo: a fold is how one person is looking at one list on
// one device right now. Writing it into `.worklog/config.json` would put a view
// preference into the user's Markdown, commit it, and sync it to every device —
// and every toggle would be a diff. Nothing here is worth a commit.
//
// It also isn't in `useWorklogUiState`: everything there dies with the session by
// design, and this is the one piece of list state that shouldn't.

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseCollapsedStore, pruneCollapsed, toggleCollapsed, type CollapsedStore } from "../utils";

export const COLLAPSED_TASKS_KEY = "worklog:collapsedTasks";
export const COLLAPSED_CLIENTS_KEY = "worklog:collapsedClients";

function readStore(storageKey: string): CollapsedStore {
  try {
    return parseCollapsedStore(localStorage.getItem(storageKey));
  } catch {
    // Storage can be blocked outright (private mode, third-party contexts), in
    // which case reading it throws rather than returning null.
    return {};
  }
}

export interface CollapsedTasks {
  /** The folded parents of the open repo. Empty until one is open. */
  collapsed: ReadonlySet<string>;
  toggleCollapsed: (id: string) => void;
}

/** `repoKey` is '' until a repo is open — folds are neither read nor written
 *  then, since there is nothing to key them to. `liveIds` is what the open repo
 *  still contains, and is only used to forget folds for things that are gone. */
export function useCollapsedTasks(
  storageKey: string,
  repoKey: string,
  liveIds: ReadonlySet<string>,
): CollapsedTasks {
  const [store, setStore] = useState<CollapsedStore>(() => readStore(storageKey));

  const collapsed = useMemo<ReadonlySet<string>>(
    () => new Set(repoKey ? (store[repoKey] ?? []) : []),
    [store, repoKey],
  );

  const toggle = useCallback(
    (id: string) => {
      if (!repoKey) {
        return;
      }
      setStore((prev) => toggleCollapsed(prev, repoKey, id));
    },
    [repoKey],
  );

  // Skipped while the repo has no tasks: that is a load in flight, not an empty
  // repo, and pruning against it would unfold everything on the way in.
  useEffect(() => {
    if (!repoKey || liveIds.size === 0) {
      return;
    }
    setStore((prev) => pruneCollapsed(prev, repoKey, liveIds));
  }, [repoKey, liveIds]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {
      // Blocked or over quota. A fold that doesn't survive the reload is the
      // whole cost — nothing downstream reads this back within the session.
    }
  }, [storageKey, store]);

  return { collapsed, toggleCollapsed: toggle };
}
