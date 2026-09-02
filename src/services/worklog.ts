// Worklog ledger edits: insert/replace and remove a (date, client) line, one day
// or a whole range of them. Time is tracked per client per day (full/half/custom
// hours), not per task. Shared by the app's calendar / day editor.

import { Store } from "../store";
import { eventWorklogClientId } from "../model/worklog";
import { serializeWorklogEntry } from "../parser/worklogParser";
import { readText, writeText, ensureDir } from "../workspace/paths";
import { monthOf } from "../util/date";

/** The month file's text with the (date, client) line inserted or replaced. Pure,
 *  so a range can apply a whole month's days to one string and write it once. */
function withEntry(
  existing: string | undefined,
  month: string,
  date: string,
  clientId: string,
  hours: number,
  note?: string,
): string {
  const line = serializeWorklogEntry({ date, clientId, hours, note });
  if (existing === undefined || existing.trim() === "") {
    return `# Worklog ${month}\n\n${line}\n`;
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
  return lines.join("\n").replace(/\s+$/, "") + "\n";
}

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
  const existing = await readText(uri);
  await writeText(uri, withEntry(existing, month, date, clientId, hours, note));
  await store.rebuild("setWorklog");
}

/** Log the same entry on every one of `dates` — a fortnight of vacation, a week
 *  spent on one client. Grouped by month file so a range is one read, one write
 *  and one rebuild per month: looping over `setWorklog` would re-parse the whole
 *  workspace once per day, and arm a commit per day with it. */
export async function setWorklogRange(
  store: Store,
  dates: string[],
  clientId: string,
  hours: number,
  note?: string,
): Promise<void> {
  if (!(hours > 0) || dates.length === 0) {
    return;
  }
  await ensureDir(store.ws.worklogDir);

  const byMonth = new Map<string, string[]>();
  for (const date of dates) {
    const month = monthOf(date);
    const days = byMonth.get(month);
    if (days) {
      days.push(date);
    } else {
      byMonth.set(month, [date]);
    }
  }

  for (const [month, days] of byMonth) {
    const uri = store.ws.worklogFile(month);
    // "" and undefined mean the same to `withEntry`: the month file starts here.
    let text = (await readText(uri)) ?? "";
    for (const date of days) {
      text = withEntry(text, month, date, clientId, hours, note);
    }
    await writeText(uri, text);
  }
  await store.rebuild("setWorklogRange");
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
