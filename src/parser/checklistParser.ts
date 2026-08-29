// Pure parser + line editors for checklist files, `lists/<id>.md`.
//
//   # Release checklist
//   - last run: 2026-08-12
//
//   ## Steps
//   - [ ] Bump the version
//   - [x] Update the changelog
//
// Plain GFM task-list items, so the file reads as a checklist on GitHub and in
// any editor. `- last run:` follows the `- key: value` meta convention the task
// blocks use, and records the day a run was *finished* — Start again stamps it.
//
// Unlike the task and day-note files, this module edits **by line** rather than
// re-serializing the file it parsed. A list is something people write in by
// hand — a nested bullet under an item, a paragraph explaining a step, a link to
// the runbook — and a serializer that only knows about items would quietly drop
// every one of those on the next tick. Rewriting the one line that changed keeps
// all of it, and makes ticking an item a one-character diff.
//
// The same fenced-code hazard `dayNotes.ts` documents applies here: a literal
// `- [ ]` inside a code fence reads as an item. Escaping it on write would make
// the file stop being something a person can hand-edit, which is the point of
// the format, so it is documented rather than defended against.

import type { Checklist, ChecklistSection } from '../model/checklist';

/** A tickable line: indent, box, then the text. The space after the box is
 *  optional so a hand-written `- [x]done` still reads as an item. */
const ITEM = /^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)$/;
const H1 = /^#[ \t]+(.*)$/;
const H2 = /^##[ \t]+(.*)$/;
const LAST_RUN = /^-[ \t]+last run:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*$/;

/** Parse a list file. Everything that isn't a heading, the meta line or an item
 *  is prose the app carries and never rewrites. */
export function parseChecklistFile(content: string, sourceFile: string, id: string): Checklist {
  const lines = content.split(/\r?\n/);
  let name = '';
  let lastRun: string | undefined;
  // The leading section is untitled and only kept when something lands in it —
  // a list that opens with `## Bike` has no anonymous group above it.
  const sections: ChecklistSection[] = [{ items: [] }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const item = ITEM.exec(line);
    if (item) {
      sections[sections.length - 1].items.push({
        text: item[4].trim(),
        done: item[3] !== ' ',
        line: i,
      });
      continue;
    }
    const h2 = H2.exec(line);
    if (h2) {
      sections.push({ title: h2[1].trim(), line: i, items: [] });
      continue;
    }
    const h1 = H1.exec(line);
    if (h1 && !name) {
      name = h1[1].trim();
      continue;
    }
    const run = LAST_RUN.exec(line);
    if (run && !lastRun) {
      lastRun = run[1];
    }
  }

  // The untitled leading section is dropped when it is empty — a list that opens
  // with `## Bike` has no anonymous group above it — unless it is the only one
  // there, because a brand-new list still needs somewhere to put its first item.
  const kept = sections.filter((s, i) => i > 0 || s.items.length > 0);
  return {
    id,
    name: name || id,
    lastRun,
    sections: kept.length ? kept : [sections[0]],
    sourceFile,
  };
}

/** The file a brand-new list starts as. */
export function newChecklistFile(name: string): string {
  return `# ${name}\n`;
}

/** Tick or untick one item, rewriting nothing but its box. */
export function setChecklistItemDone(content: string, line: number, done: boolean): string {
  return editLine(content, line, (raw) => {
    const m = ITEM.exec(raw);
    return m ? `${m[1]}${m[2]} [${done ? 'x' : ' '}] ${m[4].trim()}` : raw;
  });
}

/** Rewrite one item's words, keeping its indent and its tick. */
export function setChecklistItemText(content: string, line: number, text: string): string {
  return editLine(content, line, (raw) => {
    const m = ITEM.exec(raw);
    return m ? `${m[1]}${m[2]} [${m[3]}] ${oneLine(text)}` : raw;
  });
}

/** Drop one item's line outright. */
export function removeChecklistItem(content: string, line: number): string {
  const lines = content.split(/\r?\n/);
  if (line < 0 || line >= lines.length) {
    return content;
  }
  lines.splice(line, 1);
  return endWithNewline(lines.join('\n'));
}

/** Add an item to the end of a section, matching the indent of what is already
 *  there so a list written with `*` or nested one level stays consistent.
 *
 *  A section with nothing in it yet takes the line straight after its heading;
 *  the untitled leading section of an empty list appends to the file. */
export function addChecklistItem(content: string, list: Checklist, sectionIndex: number, text: string): string {
  const section = list.sections[sectionIndex];
  if (!section) {
    return content;
  }
  const lines = content.split(/\r?\n/);
  const last = section.items[section.items.length - 1];
  const template = last ? ITEM.exec(lines[last.line]) : null;
  const prefix = template ? `${template[1]}${template[2]}` : '-';
  const at = last ? last.line + 1 : section.line !== undefined ? section.line + 1 : lines.length;
  lines.splice(at, 0, `${prefix} [ ] ${oneLine(text)}`);
  return endWithNewline(lines.join('\n'));
}

/** Start the list over: every box cleared, and the day the finished run closed
 *  stamped as `- last run:` under the title.
 *
 *  The stamp is the date of the run being *ended*, not of the one beginning —
 *  "when did I last do a release" is the question a reader has. */
export function resetChecklist(content: string, date: string): string {
  const lines = untickAll(content.split(/\r?\n/));
  const existing = lines.findIndex((l) => LAST_RUN.test(l));
  if (existing >= 0) {
    lines[existing] = `- last run: ${date}`;
  } else {
    // Under the title, where the task blocks keep their meta. A file with no
    // title at all gets it on the first line rather than nowhere.
    const title = lines.findIndex((l) => H1.test(l));
    lines.splice(title + 1, 0, `- last run: ${date}`);
  }
  return endWithNewline(lines.join('\n'));
}

/** Start a new `## ` group at the end of the file. Appended rather than slotted
 *  in: the order of a list is the order it is worked through, and a new group is
 *  the one you haven't done yet. */
export function addChecklistSection(content: string, title: string): string {
  const lines = content.replace(/\s+$/, '').split(/\r?\n/);
  return endWithNewline([...lines, '', `## ${oneLine(title)}`].join('\n'));
}

/** Rewrite one group's heading. */
export function renameChecklistSection(content: string, line: number, title: string): string {
  return editLine(content, line, (raw) => (H2.test(raw) ? `## ${oneLine(title)}` : raw));
}

/** Remove a group and everything under it, up to the next `## ` or the end of
 *  the file — its items, and any prose that was sitting in it. Deleting the
 *  heading alone would silently move those items into the group above, which is
 *  not what "delete this section" looks like from the outside. */
export function removeChecklistSection(content: string, line: number): string {
  const lines = content.split(/\r?\n/);
  if (line < 0 || line >= lines.length || !H2.test(lines[line])) {
    return content;
  }
  let end = line + 1;
  while (end < lines.length && !H2.test(lines[end])) {
    end++;
  }
  lines.splice(line, end - line);
  return endWithNewline(lines.join('\n'));
}

/** Rewrite the `# ` title, adding one to a file that somehow has none. */
export function renameChecklist(content: string, name: string): string {
  const lines = content.split(/\r?\n/);
  const title = lines.findIndex((l) => H1.test(l));
  if (title < 0) {
    return endWithNewline([`# ${oneLine(name)}`, '', ...lines].join('\n'));
  }
  lines[title] = `# ${oneLine(name)}`;
  return endWithNewline(lines.join('\n'));
}

/** Move one item to a place in a section — its own or another's.
 *
 *  `index` is the position among that section's items as they are *now*, so
 *  moving the first item to index 2 of a three-item section lands it between the
 *  second and the third. Dropping onto the list is the gesture, and "before the
 *  one I aimed at" is what a drop means.
 *
 *  The line keeps its own bullet and indent rather than adopting the
 *  destination's, unlike `addChecklistItem`: this is the same item, and
 *  rewriting its marker would make a move a two-line diff for no gain. */
export function moveChecklistItem(
  content: string,
  list: Checklist,
  line: number,
  sectionIndex: number,
  index: number,
): string {
  const lines = content.split(/\r?\n/);
  const section = list.sections[sectionIndex];
  if (!section || line < 0 || line >= lines.length || !ITEM.test(lines[line])) {
    return content;
  }
  const items = section.items;
  let at: number;
  if (items.length === 0) {
    if (section.line === undefined) {
      return content; // an empty untitled section has no anchor to insert against
    }
    at = section.line + 1;
  } else if (index >= items.length) {
    at = items[items.length - 1].line + 1;
  } else {
    at = items[index].line;
  }
  // Landing where it already is. Both spellings of "no move" — before itself and
  // after itself — because a drop on either edge of a row means the same thing.
  if (at === line || at === line + 1) {
    return content;
  }
  const [moved] = lines.splice(line, 1);
  lines.splice(at > line ? at - 1 : at, 0, moved);
  return endWithNewline(lines.join('\n'));
}

/** Swap a `## ` group with the one before or after it, items and prose included.
 *
 *  The one edit in this module that touches spacing it didn't write: the blank
 *  line separating two groups belongs *between* them, so moving a block past
 *  another leaves headings glued to the items above them. A blank line is put
 *  back before any heading that lost one — never more than that, so a file
 *  spaced by hand keeps its spacing everywhere the move didn't disturb. */
export function moveChecklistSection(content: string, line: number, direction: -1 | 1): string {
  const lines = content.replace(/\s+$/, '').split(/\r?\n/);
  if (line < 0 || line >= lines.length || !H2.test(lines[line])) {
    return content;
  }
  const end = sectionEnd(lines, line);
  let at: number;
  if (direction === 1) {
    if (end >= lines.length) {
      return content; // already the last group
    }
    at = line + (sectionEnd(lines, end) - end);
  } else {
    let prev = line - 1;
    while (prev >= 0 && !H2.test(lines[prev])) {
      prev--;
    }
    if (prev < 0) {
      return content; // nothing above it but the title and the ungrouped items
    }
    at = prev;
  }
  lines.splice(at, 0, ...lines.splice(line, end - line));
  return endWithNewline(spaceSections(lines).join('\n'));
}

/** A copy of a list, ready to run: same name with "copy" on it, same items and
 *  groups, nothing ticked and no `- last run:` stamp.
 *
 *  The ticks stay on the original, which is the point — you duplicate the list
 *  you have just worked through to keep it as the record of that run, and start
 *  the copy from the top. */
export function copyChecklistFile(content: string, name: string): string {
  const lines = untickAll(content.split(/\r?\n/).filter((l) => !LAST_RUN.test(l)));
  return renameChecklist(endWithNewline(lines.join('\n')), name);
}

// ---- the merge's view of a list file --------------------------------------

/** One item as the sync merge sees it: the item's own line, preceded by whatever
 *  prose and headings sit between it and the item before it. Carrying those
 *  along is what keeps a section heading with the items under it when the merge
 *  reorders records — the same trick a task record plays with its `## ` heading. */
export interface ChecklistRecord {
  /** Identity across versions: the item's words, plus which occurrence of them
   *  this is, so a list holding "Charger" twice keeps both. */
  key: string;
  text: string;
}

/** Split a list file into the lines before its first item and one record per
 *  item. Trailing prose rides on the last record so nothing is dropped. */
export function splitChecklistItems(content: string): { header: string; records: ChecklistRecord[] } {
  const lines = content.split(/\r?\n/);
  const records: ChecklistRecord[] = [];
  const seen = new Map<string, number>();
  let pending: string[] = [];
  let header: string | undefined;

  for (const line of lines) {
    const m = ITEM.exec(line);
    if (!m) {
      pending.push(line);
      continue;
    }
    if (header === undefined) {
      header = pending.join('\n');
      pending = [];
    }
    const text = m[4].trim();
    const n = (seen.get(text) ?? 0) + 1;
    seen.set(text, n);
    records.push({ key: `item:${n}:${text}`, text: [...pending, line].join('\n') });
    pending = [];
  }

  // Whatever follows the last item belongs to it; with no items at all the file
  // is header and nothing else.
  if (records.length && pending.join('\n').trim() !== '') {
    records[records.length - 1].text += '\n' + pending.join('\n').replace(/\s+$/, '');
  }
  return { header: header ?? lines.join('\n'), records };
}

/** Reassemble a header and its item records. The only writer for a merged list
 *  file — records carry their own blank lines, so this joins rather than
 *  re-spaces, and normalizes only the end of the file. */
export function joinChecklist(header: string, records: readonly ChecklistRecord[]): string {
  const body = records.map((r) => r.text).join('\n');
  if (!body) {
    return endWithNewline(header);
  }
  return endWithNewline(header ? `${header}\n${body}` : body);
}

// ---- helpers --------------------------------------------------------------

/** Where the group starting at `line` ends: the next `## `, or the end. */
function sectionEnd(lines: readonly string[], line: number): number {
  let end = line + 1;
  while (end < lines.length && !H2.test(lines[end])) {
    end++;
  }
  return end;
}

/** Every box cleared. Shared by Start again and Duplicate, which differ only in
 *  what they do with the stamp. */
function untickAll(lines: string[]): string[] {
  for (let i = 0; i < lines.length; i++) {
    const m = ITEM.exec(lines[i]);
    if (m && m[3] !== ' ') {
      lines[i] = `${m[1]}${m[2]} [ ] ${m[4].trim()}`;
    }
  }
  return lines;
}

/** A blank line before every heading that hasn't got one. Only ever adds. */
function spaceSections(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (H2.test(line) && out.length > 0 && out[out.length - 1].trim() !== '') {
      out.push('');
    }
    out.push(line);
  }
  return out;
}

function editLine(content: string, line: number, rewrite: (raw: string) => string): string {
  const lines = content.split(/\r?\n/);
  if (line < 0 || line >= lines.length) {
    return content;
  }
  lines[line] = rewrite(lines[line]);
  return endWithNewline(lines.join('\n'));
}

/** What a checklist item can hold: one line, no leading bullet of its own. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function endWithNewline(text: string): string {
  const body = text.replace(/\s+$/, '');
  return body ? `${body}\n` : '';
}
