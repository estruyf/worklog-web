import { isEventWorklogClientId } from "../../model/worklog";
import type { Client, WorklogEntry } from "../../model/types";

interface DefaultTaskClientParams {
  preferredClientId?: string;
  selectedClientId?: string;
  selectedDate?: string;
  today?: string;
  clients: Client[];
  worklog: WorklogEntry[];
}

/**
 * Pick the default client for a newly created task.
 *
 * Priority:
 * 1) Explicit preferred client id, if valid.
 * 2) Exactly one non-event client logged on the selected day.
 * 3) If multiple clients are logged, keep the selected client if it is among them,
 *    otherwise use the first logged client for that day.
 * 4) If no clients are logged on that day, leave unselected.
 * 5) If no day context exists, fall back to selected client, then first configured client.
 */
export function defaultTaskClientId({
  preferredClientId,
  selectedClientId,
  selectedDate,
  today,
  clients,
  worklog,
}: DefaultTaskClientParams): string {
  const clientIds = new Set(clients.map((c) => c.id));

  if (preferredClientId && clientIds.has(preferredClientId)) {
    return preferredClientId;
  }

  const date = selectedDate || today;
  if (date) {
    const loggedClientIds = Array.from(
      new Set(
        worklog
          .filter((entry) => entry.date === date)
          .map((entry) => entry.clientId)
          .filter((id) => !isEventWorklogClientId(id) && clientIds.has(id)),
      ),
    );

    if (loggedClientIds.length === 1) {
      return loggedClientIds[0];
    }
    if (loggedClientIds.length > 1) {
      if (selectedClientId && loggedClientIds.includes(selectedClientId)) {
        return selectedClientId;
      }
      return loggedClientIds[0];
    }

    return "";
  }

  if (selectedClientId && clientIds.has(selectedClientId)) {
    return selectedClientId;
  }

  return clients[0]?.id || "";
}
