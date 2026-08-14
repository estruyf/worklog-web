// Whether the desktop navigation rail is collapsed to icons, remembered across
// reloads. Read by `Sidebar`, which is the only caller.
//
// localStorage for the same reason as `useCollapsedTasks`: how wide the rail is on
// this screen is not something to commit to the user's repo and sync to every
// device. It also isn't in `useWorklogUiState`, where everything dies with the
// session — a rail you collapsed should still be collapsed tomorrow.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "worklog:sidebarCollapsed";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage can be blocked outright (private mode, third-party contexts), in
    // which case reading it throws rather than returning null.
    return false;
  }
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(read);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Blocked or over quota. A rail that reopens wide on the next load is the
      // whole cost.
    }
  }, [collapsed]);

  return [collapsed, toggle];
}
