// Which parent tasks are folded shut in the task lists, remembered per repo
// across reloads. Read by `useWorklogModel`, which hands the set to `useTaskRows`.
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

const STORAGE_KEY = "worklog:collapsedTasks";

function readStore(): CollapsedStore {
  try {
    return parseCollapsedStore(localStorage.getItem(STORAGE_KEY));
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
 *  then, since there is nothing to key them to. `liveTaskIds` is what the open
 *  repo still contains, and is only used to forget folds for deleted tasks. */
export function useCollapsedTasks(repoKey: string, liveTaskIds: ReadonlySet<string>): CollapsedTasks {
  const [store, setStore] = useState<CollapsedStore>(readStore);

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
    if (!repoKey || liveTaskIds.size === 0) {
      return;
    }
    setStore((prev) => pruneCollapsed(prev, repoKey, liveTaskIds));
  }, [repoKey, liveTaskIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Blocked or over quota. A fold that doesn't survive the reload is the
      // whole cost — nothing downstream reads this back within the session.
    }
  }, [store]);

  return { collapsed, toggleCollapsed: toggle };
}
