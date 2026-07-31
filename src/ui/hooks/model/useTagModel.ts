// Tags: the vocabulary in use across every task, and the filter the search
// overlay browses it with.

import { useCallback, useMemo } from "react";
import type { Task } from "../../../model/types";
import type { WorklogUiState } from "../useWorklogUiState";

export function useTagModel(tasks: Task[], ui: WorklogUiState) {
  const { setTagFilter, setDetailId, setSearchOpen } = ui;

  // Every tag in use with how often, most-used first: the filter row in the
  // search overlay, and what makes a tag chip more than decoration.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      for (const tag of t.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [tasks]);

  const toggleTagFilter = useCallback(
    (tag: string) => {
      setTagFilter((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    },
    [setTagFilter],
  );

  const clearTagFilter = useCallback(() => setTagFilter([]), [setTagFilter]);

  /** Follow a tag chip from anywhere in the app into the search overlay, showing
   *  every task carrying it (open and archived). */
  const openTagSearch = useCallback(
    (tag: string) => {
      setTagFilter([tag]);
      setDetailId(null);
      setSearchOpen(true);
    },
    [setTagFilter, setDetailId, setSearchOpen],
  );

  return { allTags, toggleTagFilter, clearTagFilter, openTagSearch };
}
