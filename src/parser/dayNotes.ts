// Pure parser + serializer for day-note files, `notes/<YYYY-MM>.md`.
//
// A day note is the freeform half of a day: what was said, decided or noticed,
// as opposed to what was billed (the ledger) or done (a task). One `## <date>`
// block per day, plain Markdown beneath it.
//
// This module owns the single rule that decides where a day block starts, and
// the single function that writes one back. Both matter for the same reason
// `taskHeading.ts` gives: if the writer thinks a block ends earlier than the
// reader does, an edit is written into a range that was never read. A body full
// of the user's own `##` headings is the normal case here, not the exception, so
// the rule is deliberately narrow — an `h2` opens a day only when its entire
// content is a bare ISO date. `## Scripts`, `### 2026-07-02` and
// `## 2026-07-02 planning` are all prose.
//
// The one case that still forks a file is a line that is *exactly* `## <date>`
// inside a fenced code block. Escaping it on write would make the file stop
// being something a person can hand-edit, which is the point of the format, so
// it is documented and fixtured rather than defended against.
//
// `isTaskHeading` does not apply: it requires an `- id:` meta run under the
// heading, so `splitTaskBlocks` sees no blocks at all in a notes file.

import type { DayNote } from '../model/types';

const DAY_HEADING = /^##[ \t]+(\d{4}-\d{2}-\d{2})[ \t]*$/;

/** One day's block as it sits in a file. */
export interface DayNoteBlock {
  date: string; // YYYY-MM-DD
  /** The body alone — no heading, no surrounding blank lines. */
  text: string;
  /** 0-based line of the `## <date>` heading. */
  line: number;
}

/** What the serializer needs; the line number is an artifact of reading. */
export type DayNoteContent = Pick<DayNoteBlock, 'date' | 'text'>;

/** Split a notes file into its leading header (everything before the first day
 *  heading) and its day blocks, in file order. Blocks with an empty body are
 *  kept here — this is the structural view; dropping them is a write decision. */
export function splitDayNoteBlocks(content: string): { header: string; blocks: DayNoteBlock[] } {
  const lines = content.split(/\r?\n/);
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (DAY_HEADING.test(lines[i])) {
      starts.push(i);
    }
  }
  const header = lines
    .slice(0, starts.length ? starts[0] : lines.length)
    .join('\n')
    .replace(/\s+$/, '');

  const blocks: DayNoteBlock[] = [];
  for (let b = 0; b < starts.length; b++) {
    const end = b + 1 < starts.length ? starts[b + 1] : lines.length;
    const date = DAY_HEADING.exec(lines[starts[b]])![1];
    blocks.push({ date, text: bodyOf(lines.slice(starts[b] + 1, end)), line: starts[b] });
  }
  return { header, blocks };
}

/** The canonical file for a header and a set of day blocks. This is the only
 *  serializer: the sync merge's splitter joins through it too, so a merge that
 *  resolves to "no change" produces a byte-identical file rather than a
 *  whitespace-only diff that shows up as a phantom commit on every sync. */
export function joinDayNotes(header: string, blocks: readonly DayNoteContent[]): string {
  const head = header.replace(/\s+$/, '');
  const body = blocks
    .filter((b) => b.text.trim() !== '')
    .map((b) => `## ${b.date}\n\n${b.text}`)
    .join('\n\n');
  if (!body) {
    return head ? `${head}\n` : '';
  }
  return head ? `${head}\n\n${body}\n` : `${body}\n`;
}

/** Parse a notes file into one record per day.
 *
 *  Read liberally: a block whose date belongs to another month is still
 *  returned, and a repeated date keeps the last block. Both beat the
 *  alternative — a hand-moved block silently swallowed into the previous day's
 *  body is data loss the next save would make permanent. */
export function parseDayNotesFile(content: string, sourceFile: string): DayNote[] {
  const byDate = new Map<string, DayNote>();
  for (const b of splitDayNoteBlocks(content).blocks) {
    if (b.text !== '') {
      byDate.set(b.date, { date: b.date, body: b.text, sourceFile, sourceLine: b.line });
    }
  }
  return [...byDate.values()];
}

/** Insert, replace or clear one day's block, returning the file's new content.
 *
 *  An empty body drops the block rather than leaving a heading with nothing
 *  under it. The file itself is kept even when the last block goes — the same
 *  choice `removeWorklog` makes, and the only one that survives a merge: a
 *  deletion here against an edit on the branch resolves back to the branch's
 *  file anyway. */
export function upsertDayNote(
  content: string | undefined,
  month: string,
  date: string,
  body: string,
): string {
  const { header, blocks } = splitDayNoteBlocks(content ?? '');
  const text = normalizeBody(body);
  const next: DayNoteContent[] = blocks.filter((b) => b.date !== date);
  if (text !== '') {
    // Insert in date order, but never re-sort what is already there: the merge
    // deliberately preserves the branch's record order, so re-sorting would have
    // two instances shuffling the same file back and forth forever.
    const at = next.findIndex((b) => b.date > date);
    next.splice(at < 0 ? next.length : at, 0, { date, text });
  }
  return joinDayNotes(header || `# Notes ${month}`, next);
}

/** A block's body: the lines under its heading, stripped of the blank lines the
 *  canonical form puts around it. */
function bodyOf(lines: string[]): string {
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') {
    start++;
  }
  return lines.slice(start).join('\n').replace(/\s+$/, '');
}

/** Normalize authored text to the form the file stores: LF endings, no leading
 *  or trailing blank lines. */
function normalizeBody(body: string): string {
  return bodyOf(body.split(/\r?\n/));
}
