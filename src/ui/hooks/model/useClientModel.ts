// Clients: resolving an id to a name and a colour, and the editor modal's
// open/save/archive/delete round trip.

import { useCallback, useMemo } from "react";
import type { Client, Task, WorklogEntry } from "../../../model/types";
import { worklogStore } from "../../../data/worklogStore";
import { GENERAL_TODO_COLOR, GENERAL_TODO_LABEL, isGeneralTodoClientId } from "../../../model/todos";
import { eventLabel, eventTypeFromClientId, isEventWorklogClientId } from "../../../model/worklog";
import { PALETTE } from "../../utils";
import type { WorklogUiState } from "../useWorklogUiState";

export function useClientModel(
  allClients: Client[],
  clients: Client[],
  tasks: Task[],
  worklog: WorklogEntry[],
  ui: WorklogUiState,
) {
  const { setClientModalOpen, setEditingClientId, setSelectedClient, setCName, setCColor, setCDesc, setCLinks } = ui;
  const { ask, notify } = ui.confirm;

  // O(1) lookup by id, rebuilt only when the snapshot's clients change. Built from
  // *all* clients so an archived one still resolves to its name and colour wherever
  // its history shows up, and so the palette index stays stable.
  const clientById = useMemo(() => {
    const m = new Map<string, { client: Client; index: number }>();
    allClients.forEach((c, i) => m.set(c.id, { client: c, index: i }));
    return m;
  }, [allClients]);

  const colorOf = useCallback(
    (id: string): string => {
      if (isGeneralTodoClientId(id)) {
        return GENERAL_TODO_COLOR;
      }
      const hit = clientById.get(id);
      const i = hit ? hit.index : -1;
      return (i >= 0 && hit!.client.color) || PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
    },
    [clientById],
  );

  const clientName = useCallback(
    (id: string): string =>
      clientById.get(id)?.client.name ??
      (isGeneralTodoClientId(id)
        ? GENERAL_TODO_LABEL
        : isEventWorklogClientId(id)
          ? eventLabel(eventTypeFromClientId(id))
          : "?"),
    [clientById],
  );

  /** How much history a client carries. Drives the copy in the client editor and
   *  gates deletion — the service refuses one that still has tasks or hours. */
  const clientUsage = useCallback(
    (id: string) => ({
      tasks: tasks.filter((t) => t.clientIds.includes(id)).length,
      worklog: worklog.filter((w) => w.clientId === id).length,
    }),
    [tasks, worklog],
  );

  /** Add a client and resolve to its id, so whoever asked can switch to it.
   *  Undefined when the name was blank or the write failed. */
  const createClient = async (name: string): Promise<string | undefined> => {
    const n = name.trim();
    if (!n) {
      return undefined;
    }
    return (await worklogStore.createClient(n))?.id;
  };

  /** Open the editor on a client, or blank for a new one. */
  const openClientEditor = (c?: Client) => {
    setEditingClientId(c?.id ?? null);
    setCName(c?.name ?? "");
    setCColor(c ? colorOf(c.id) : PALETTE[clients.length % PALETTE.length]);
    setCDesc(c?.description ?? "");
    setCLinks((c?.links ?? []).map((l) => ({ url: l.url, label: l.label ?? "" })));
    setClientModalOpen(true);
  };

  const saveClient = () => {
    const name = ui.cName.trim();
    if (!name) {
      return;
    }
    // Blank rows the user added but never filled in are dropped rather than saved.
    const links = ui.cLinks.map((l) => ({ url: l.url.trim(), label: l.label.trim() })).filter((l) => l.url);
    const description = ui.cDesc.trim();
    if (ui.editingClientId) {
      worklogStore.updateClient(ui.editingClientId, { name, color: ui.cColor, description, links });
    } else {
      // Close first, select once it lands: the write is local and quick, but the
      // modal has already done its job either way.
      worklogStore
        .createClient(name, ui.cColor, { description, links })
        .then((created) => created && setSelectedClient(created.id));
    }
    setClientModalOpen(false);
  };

  const setClientArchived = useCallback(
    (c: Client, archived: boolean) => {
      worklogStore.setClientArchived(c.id, archived);
      setClientModalOpen(false);
    },
    [setClientModalOpen],
  );

  const deleteClient = useCallback(
    async (c: Client) => {
      const usage = clientUsage(c.id);
      if (usage.tasks > 0 || usage.worklog > 0) {
        // Archiving is the non-destructive answer; the service refuses this too.
        await notify({
          title: `"${c.name}" still has history`,
          message:
            `It carries ${usage.tasks} task${usage.tasks === 1 ? "" : "s"} and ` +
            `${usage.worklog} time entr${usage.worklog === 1 ? "y" : "ies"}, so it can't be deleted. ` +
            "Archive it instead to hide it while keeping every task and logged hour.",
        });
        return;
      }
      const ok = await ask({
        title: `Delete "${c.name}"?`,
        message: "It has no tasks or logged time, so nothing is lost. This cannot be undone.",
        confirmLabel: "Delete client",
        tone: "danger",
      });
      if (!ok) {
        return;
      }
      worklogStore.deleteClient(c.id);
      setClientModalOpen(false);
    },
    [clientUsage, ask, notify, setClientModalOpen],
  );

  return {
    colorOf,
    clientName,
    clientUsage,
    createClient,
    openClientEditor,
    saveClient,
    setClientArchived,
    deleteClient,
  };
}
