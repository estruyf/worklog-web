// The full app state pushed to a webview on every cache change. Shared by the
// dashboard editor and the standalone task windows so both stay live off the
// same store.

import { Store } from "../store";
import type { Snapshot } from "../webview/protocol";
import { today } from "../util/date";

export function buildSnapshot(store: Store, assetsBase: string): Snapshot {
  const config = store.getConfig();
  return {
    today: today(),
    hoursPerDay: config.hoursPerDay,
    weekStart: config.weekStart,
    assetsBase,
    statuses: config.statuses,
    clients: store.db.getClients(),
    tasks: store.db.getAllTasks(),
    worklog: store.db.getAllWorklog(),
  };
}
