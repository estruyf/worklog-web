// Pure parser for worklog ledger files (see spec §3.4).
// Line format: `- <YYYY-MM-DD> <client-id> <hours> [— <note>]`

import type { WorklogEntry } from "../model/types";

// `- 2026-06-25 acme 4 — morning, social feed`
// The note separator is an em dash (—) optionally surrounded by spaces; we also
// accept a plain ` - ` or `: ` for forgiving hand-editing.
const LINE =
  /^-\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s+([\d.]+)\s*(?:[—–]|-{1,2}|:)?\s*(.*)$/;

export function parseWorklogFile(
  content: string,
  sourceFile: string,
): WorklogEntry[] {
  const lines = content.split(/\r?\n/);
  const entries: WorklogEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = LINE.exec(lines[i].trim());
    if (!m) {
      continue;
    }
    const hours = Number(m[3]);
    if (!isFinite(hours)) {
      continue;
    }
    const note = m[4]?.trim();
    entries.push({
      date: m[1],
      clientId: m[2],
      hours,
      note: note ? note : undefined,
      sourceFile,
      sourceLine: i,
    });
  }
  return entries;
}

/** Serialize a single worklog entry into its canonical line. */
export function serializeWorklogEntry(
  entry: Pick<WorklogEntry, "date" | "clientId" | "hours" | "note">,
): string {
  const base = `- ${entry.date} ${entry.clientId} ${formatHours(entry.hours)}`;
  return entry.note ? `${base} — ${entry.note}` : base;
}

function formatHours(hours: number): string {
  // Keep integers clean (8 not 8.0), allow halves/decimals through.
  return Number.isInteger(hours) ? String(hours) : String(hours);
}
