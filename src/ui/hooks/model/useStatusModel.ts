// Statuses: resolving one to how it should look, moving a task between them, and
// the settings editor's add / rename / reorder / remove round trip.

import { useCallback, useMemo } from "react";
import type { StatusDef, Task } from "../../../model/types";
import { orphanStatusIds } from "../../../model/status";
import { worklogStore } from "../../../data/worklogStore";
import type { StatusChoice, StatusMetaFn } from "../../model";
import { resolveStatusMeta } from "../../utils";
import type { WorklogUiState } from "../useWorklogUiState";

/** An orphan id turned back into something a person would have typed:
 *  `waiting-for` → `Waiting for`. Only used to seed the label when a removed
 *  status is put back, so it never has to be right, just recognisable. */
function labelFromId(id: string): string {
  const words = id.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : id;
}

export function useStatusModel(statuses: StatusDef[], tasks: Task[], ui: WorklogUiState) {
  const { ask } = ui.confirm;

  // O(1) lookup by id, rebuilt only when the snapshot's statuses change.
  const statusById = useMemo(() => {
    const m = new Map<string, StatusDef>();
    statuses.forEach((s) => m.set(s.id, s));
    return m;
  }, [statuses]);

  // Where `reopen` puts a task back: the first working status, the same place a
  // newly created one starts.
  const firstStatusId = statuses.find((s) => !s.terminal)?.id ?? statuses[0]?.id ?? "open";

  const statusMeta = useCallback<StatusMetaFn>(
    (statusId, done) => resolveStatusMeta(statusById.get(statusId), statusId, done),
    [statusById],
  );

  // One array for every picker on screen, so a task row's memoized props don't
  // change just because some other row re-rendered.
  const statusChoices = useMemo<StatusChoice[]>(
    () =>
      statuses.map((s) => {
        const meta = resolveStatusMeta(s, s.id, !!s.terminal);
        return { id: s.id, name: meta.name, color: meta.color, terminal: !!s.terminal };
      }),
    [statuses],
  );

  const setTaskStatus = useCallback((taskId: string, statusId: string) => {
    worklogStore.setStatus(taskId, statusId);
  }, []);

  // Undo re-closes the task and puts its original completion date back — a
  // restore-then-undo must not restamp last year's task as completed today. An
  // archived occurrence of a recurring task gets no Undo: reopening one winds it
  // back into the live task, so the id the undo would close no longer exists.
  const reopen = useCallback(
    async (t: Task) => {
      const prior = { status: t.status, completed: t.completed };
      const reopened = await worklogStore.setStatus(t.id, firstStatusId);
      if (!reopened) {
        return;
      }
      worklogStore.notify({
        message: `Reopened “${t.title}”`,
        tone: "success",
        action: t.repeatOf
          ? undefined
          : {
              label: "Undo",
              run: () =>
                void (async () => {
                  await worklogStore.setStatus(t.id, prior.status);
                  if (prior.completed) {
                    await worklogStore.setCompletedDate(t.id, prior.completed);
                  }
                })(),
            },
      });
    },
    [firstStatusId],
  );

  // ---- settings editor ------------------------------------------------------

  /** How many tasks — open and archived — sit in a status. Drives the counts in
   *  the editor and the warning before one is removed. */
  const statusUsage = useCallback((id: string) => tasks.filter((t) => t.status === id).length, [tasks]);

  /** The orphans, plus the label the editor would seed if one were put back. */
  const orphanStatuses = useMemo(
    () => orphanStatusIds(statuses, tasks).map((o) => ({ ...o, label: labelFromId(o.id) })),
    [statuses, tasks],
  );

  const createStatus = useCallback((label: string, color?: string, id?: string) => {
    worklogStore.createStatus({ label, color, id });
  }, []);

  const updateStatus = useCallback((id: string, fields: { label?: string; color?: string }) => {
    worklogStore.updateStatus(id, fields);
  }, []);

  const moveStatus = useCallback((id: string, delta: -1 | 1) => {
    worklogStore.moveStatus(id, delta);
  }, []);

  /** Remove a status, having said plainly what removing it does not do: the
   *  tasks sitting in it keep the id, because it lives in their Markdown and
   *  reassigning them would be a bulk edit nobody asked for. */
  const deleteStatus = useCallback(
    async (status: StatusDef) => {
      const used = statusUsage(status.id);
      const ok = await ask({
        title: `Remove the “${status.label}” status?`,
        message: used
          ? `${used} task${used === 1 ? "" : "s"} still ${used === 1 ? "sits" : "sit"} in it. ` +
            `They keep showing “${status.label.toUpperCase()}” until you move them on — removing it here only takes it ` +
            "out of the pickers. It stays listed under “Still in use” below so you can put it back or clear it out."
          : "No task is using it, so nothing changes anywhere else.",
        confirmLabel: "Remove status",
        tone: "danger",
      });
      if (ok) {
        worklogStore.deleteStatus(status.id);
      }
    },
    [ask, statusUsage],
  );

  return {
    statusMeta,
    statusChoices,
    setTaskStatus,
    reopen,
    statusUsage,
    orphanStatuses,
    createStatus,
    updateStatus,
    moveStatus,
    deleteStatus,
  };
}
