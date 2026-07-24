// Worklog ledger edits: insert/replace and remove a (date, client) line. Time is
// tracked per client per day (full/half/custom hours), not per task. Shared by
// the app's calendar / day editor.

import { Store } from "../store";
import { eventWorklogClientId } from "../model/worklog";
import { serializeWorklogEntry } from "../parser/worklogParser";
import { readText, writeText, ensureDir } from "../workspace/paths";
import { monthOf } from "../util/date";

/** Insert or replace the single line for (date, client) in worklog/<month>.md. */
export async function setWorklog(
  store: Store,
  date: string,
  clientId: string,
  hours: number,
  note?: string,
): Promise<void> {
  if (!(hours > 0)) {
    return removeWorklog(store, date, clientId);
  }
  const month = monthOf(date);
  const uri = store.ws.worklogFile(month);
  await ensureDir(store.ws.worklogDir);

  const line = serializeWorklogEntry({ date, clientId, hours, note });
  const existing = await readText(uri);

  if (existing === undefined || existing.trim() === "") {
    await writeText(uri, `# Worklog ${month}\n\n${line}\n`);
    await store.rebuild("setWorklog");
    return;
  }

  const lines = existing.split(/\r?\n/);
  const prefix = `- ${date} ${clientId} `;
  const idx = lines.findIndex((l) => l.startsWith(prefix));
  if (idx >= 0) {
    lines[idx] = line;
  } else {
    let insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === "") {
      insertAt--;
    }
    lines.splice(insertAt, 0, line);
  }
  await writeText(uri, lines.join("\n").replace(/\s+$/, "") + "\n");
  await store.rebuild("setWorklog");
}

/** Insert or replace a non-client day event (vacation, ooo, conference, ...). */
export async function setEventWorklog(
  store: Store,
  date: string,
  eventType: string,
  hours: number,
  note?: string,
): Promise<void> {
  return setWorklog(store, date, eventWorklogClientId(eventType), hours, note);
}

/** Remove the (date, client) line, if present. */
export async function removeWorklog(
  store: Store,
  date: string,
  clientId: string,
): Promise<void> {
  const uri = store.ws.worklogFile(monthOf(date));
  const existing = await readText(uri);
  if (existing === undefined) {
    return;
  }
  const prefix = `- ${date} ${clientId} `;
  const lines = existing.split(/\r?\n/).filter((l) => !l.startsWith(prefix));
  await writeText(uri, lines.join("\n").replace(/\s+$/, "") + "\n");
  await store.rebuild("removeWorklog");
}
