// Statuses: resolving one to how it should look, and moving a task between them.

import { useCallback, useMemo } from "react";
import type { StatusDef, Task } from "../../../model/types";
import { worklogStore } from "../../../data/worklogStore";
import type { StatusMetaFn } from "../../model";
import { resolveStatusMeta } from "../../utils";

export function useStatusModel(statuses: StatusDef[]) {
  // O(1) lookup by id, rebuilt only when the snapshot's statuses change.
  const statusById = useMemo(() => {
    const m = new Map<string, StatusDef>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

  // The statuses a task cycles through; the terminal one is reached by closing it.
  const nonTerminal = useMemo(() => statuses.filter((s) => !s.terminal), [statuses]);
  const firstStatusId = nonTerminal[0]?.id ?? statuses[0]?.id ?? "open";

  const statusMeta = useCallback<StatusMetaFn>(
    (statusId, done) => resolveStatusMeta(statusById.get(statusId), statusId, done),
    [statusById],
  );

  const cycleStatus = useCallback(
    (t: Task) => {
      if (nonTerminal.length === 0) {
        return;
      }
      const i = nonTerminal.findIndex((s) => s.id === t.status);
      const next = nonTerminal[(i + 1) % nonTerminal.length];
      worklogStore.setStatus(t.id, next.id);
    },
    [nonTerminal],
  );

  const reopen = useCallback((t: Task) => worklogStore.setStatus(t.id, firstStatusId), [firstStatusId]);

  return { nonTerminal, firstStatusId, statusMeta, cycleStatus, reopen };
}
