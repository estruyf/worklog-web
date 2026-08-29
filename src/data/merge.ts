// Three-way merge for sync.
//
// Two browser instances editing the same Worklog repo both rewrite whole files:
// adding a task rewrites `clients/<id>.md`, logging time rewrites
// `worklog/<month>.md`. Committing the local blob over whatever the branch holds
// would therefore silently drop everything the other instance changed in that
// same file — so before pushing, `worklogStore` merges each dirty file against
// the branch here.
//
// The merge is structural, not line-based: these files are lists of records with
// stable keys (a task block keyed by `- id:`, a ledger line keyed by date +
// client, a config entry keyed by its id), so the merge is the standard
// three-way rule applied per record:
//
//   changed on one side only -> take that side (including deletions)
//   changed on both sides    -> keep the local version and report a conflict
//
// Records added by either side are kept. That covers the case that matters —
// "I added a task here while the other instance edited a task there" — without
// ever emitting conflict markers into markdown the parser would choke on.

import { splitTaskBlocks } from '../parser/blocks';
import { joinDayNotes, splitDayNoteBlocks } from '../parser/dayNotes';
import { joinChecklist, splitChecklistItems } from '../parser/checklistParser';

/** The three sides of a merge. `undefined` means the file is absent on that side. */
export interface MergeSides {
  /** The content both sides started from (the version last loaded/pushed). */
  base: string | undefined;
  /** This instance's content. */
  local: string | undefined;
  /** The branch's content now. */
  remote: string | undefined;
}

export interface MergeResult {
  /** The merged content, or `undefined` when the merge resolves to a deletion. */
  text: string | undefined;
  /** Human-readable notes for records that changed on both sides. */
  conflicts: string[];
}

/** Merge one file's three versions, dispatching on the path's format. */
export function mergeFile(path: string, sides: MergeSides): MergeResult {
  const { base, local, remote } = sides;

  // Whole-file shortcuts, and the cases where structural merging can't apply
  // because one side no longer has a file to parse.
  if (local === remote) {
    return { text: local, conflicts: [] };
  }
  if (remote === base) {
    return { text: local, conflicts: [] };
  }
  if (local === base) {
    return { text: remote, conflicts: [] };
  }
  if (local === undefined) {
    // Deleted here, changed on the branch. Deleting would throw away work that
    // only exists there, so the branch wins and the delete is reported.
    return { text: remote, conflicts: [`${path} was deleted here but changed on GitHub — kept the GitHub version`] };
  }
  if (remote === undefined) {
    // Deleted on the branch, changed here. Same reasoning, the other way round.
    return { text: local, conflicts: [`${path} was deleted on GitHub but changed here — kept your version`] };
  }

  // No known ancestor (a snapshot written before base tracking, or a file both
  // sides created): merging against an empty base keeps every record from both
  // and only flags the ones that genuinely differ.
  const ancestor = base ?? '';

  if (path === '.worklog/config.json') {
    return mergeConfigJson(path, ancestor, local, remote);
  }
  if (/^worklog\/[^/]+\.md$/.test(path)) {
    return mergeRecordFile(path, ancestor, local, remote, splitLedger);
  }
  if (/^clients\/[^/]+\.md$/.test(path) || /^archive\/[^/]+\/[^/]+\.md$/.test(path)) {
    return mergeRecordFile(path, ancestor, local, remote, splitTasks);
  }
  if (/^notes\/[^/]+\.md$/.test(path)) {
    return mergeRecordFile(path, ancestor, local, remote, splitDayNotes);
  }
  if (/^lists\/[^/]+\.md$/.test(path)) {
    return mergeRecordFile(path, ancestor, local, remote, splitChecklist);
  }
  // Unknown text file: no structure to merge on, so the local edit wins and the
  // caller gets told the branch's version was dropped.
  return { text: local, conflicts: [`${path} changed here and on GitHub — kept your version`] };
}

// ---- record model ---------------------------------------------------------

interface MergeRecord {
  /** Identity across versions of the file. */
  key: string;
  /** The record's text as it appears in the file. */
  text: string;
}

interface SplitFile {
  /** Leading lines that aren't records (the `# Title` and its blank line). */
  header: string;
  records: MergeRecord[];
  /** Reassemble a header + records back into file content. */
  join(header: string, records: MergeRecord[]): string;
}

type Splitter = (content: string) => SplitFile;

/** Task files: one record per `## ` block, keyed by its `- id:`. */
function splitTasks(content: string): SplitFile {
  const { header, blocks } = splitTaskBlocks(content);
  return {
    header,
    records: blocks.map((b) => ({ key: b.id ? `id:${b.id}` : `text:${b.text.trim()}`, text: b.text })),
    join: (h, records) => {
      const parts = records.map((r) => r.text.replace(/\s+$/, ''));
      const body = parts.join('\n\n');
      const head = h.replace(/\s+$/, '');
      if (!body) {
        return head ? `${head}\n` : '';
      }
      return head ? `${head}\n\n${body}\n` : `${body}\n`;
    },
  };
}

/** Day-note files: one record per `## <date>` block, keyed by the date.
 *
 *  The record text carries its own heading, as a task record does, so the
 *  three-way comparison sees the whole block. The join goes through
 *  `joinDayNotes` rather than assembling text here: two serializers for one
 *  format drift, and the drift shows up as a no-op merge that still rewrites the
 *  file — a phantom dirty commit on every sync. */
function splitDayNotes(content: string): SplitFile {
  const { header, blocks } = splitDayNoteBlocks(content);
  return {
    header,
    records: blocks.map((b) => ({ key: `date:${b.date}`, text: `## ${b.date}\n\n${b.text}` })),
    join: (h, recs) => joinDayNotes(h, recs.flatMap((r) => splitDayNoteBlocks(r.text).blocks)),
  };
}

/** Checklist files: one record per `- [ ]` item, keyed by its words.
 *
 *  Ticking is the edit these files get, and it is per item, so two devices
 *  working through the same list on the same trip merge cleanly. The title, the
 *  `- last run:` stamp and the section headings ride along as the header and the
 *  records' own prefix lines — see `splitChecklistItems` for why.
 *
 *  The known wart: renaming an item reads as a delete plus an add, so rewording
 *  one here while the other device ticks or rewords it leaves *both* wordings in
 *  the list. Nothing is lost — you delete the one you don't want — which is the
 *  right way for this to fail. Ids in the Markdown would resolve it properly and
 *  would also stop the file being something you can hand-edit, which is the
 *  point of the format. */
function splitChecklist(content: string): SplitFile {
  const { header, records } = splitChecklistItems(content);
  return { header, records, join: (h, recs) => joinChecklist(h, recs) };
}

const LEDGER_LINE = /^-\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s/;

/** Ledger files: one record per line, keyed by date + client so the same day's
 *  entry for the same client is recognized as the same record. */
function splitLedger(content: string): SplitFile {
  const lines = content.split(/\r?\n/);
  let start = 0;
  while (start < lines.length && (lines[start].trim() === '' || lines[start].startsWith('#'))) {
    start++;
  }
  const header = lines.slice(0, start).join('\n').replace(/\s+$/, '');
  const records: MergeRecord[] = [];
  for (const line of lines.slice(start)) {
    if (line.trim() === '') {
      continue;
    }
    const m = LEDGER_LINE.exec(line.trim());
    records.push({ key: m ? `${m[1]} ${m[2]}` : `text:${line.trim()}`, text: line });
  }
  return {
    header,
    records,
    join: (h, recs) => {
      const body = recs.map((r) => r.text).join('\n');
      const head = h.replace(/\s+$/, '');
      if (!body) {
        return head ? `${head}\n` : '';
      }
      return head ? `${head}\n\n${body}\n` : `${body}\n`;
    },
  };
}

function mergeRecordFile(path: string, base: string, local: string, remote: string, split: Splitter): MergeResult {
  const b = split(base);
  const l = split(local);
  const r = split(remote);
  const { records, conflicts } = mergeRecords(path, b.records, l.records, r.records);
  const header = pick3(b.header, l.header, r.header);
  if (header.conflict) {
    conflicts.push(`${path}: the file heading changed here and on GitHub — kept your version`);
  }
  return { text: l.join(header.value, records), conflicts };
}

/** The three-way rule over two keyed record lists. Deletions are respected when
 *  only one side made them; a record touched on both sides keeps the local text. */
function mergeRecords(
  path: string,
  base: MergeRecord[],
  local: MergeRecord[],
  remote: MergeRecord[],
): { records: MergeRecord[]; conflicts: string[] } {
  const byKey = (list: MergeRecord[]) => new Map(list.map((rec) => [rec.key, rec.text]));
  const b = byKey(base);
  const l = byKey(local);
  const r = byKey(remote);

  const resolved = new Map<string, string | undefined>();
  const conflicts: string[] = [];
  for (const key of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const inBase = b.has(key);
    const lv = l.get(key);
    const rv = r.get(key);
    if (lv === rv) {
      resolved.set(key, lv);
      continue;
    }
    if (!inBase) {
      // Added on one side, or added on both with different text.
      if (lv === undefined) {
        resolved.set(key, rv);
      } else if (rv === undefined) {
        resolved.set(key, lv);
      } else {
        resolved.set(key, lv);
        conflicts.push(`${path}: ${describe(key)} was added here and on GitHub — kept your version`);
      }
      continue;
    }
    const bv = b.get(key);
    if (lv === bv) {
      resolved.set(key, rv); // only the branch touched it (edit or delete)
    } else if (rv === bv) {
      resolved.set(key, lv); // only this instance touched it
    } else if (lv === undefined && rv === undefined) {
      resolved.set(key, undefined); // deleted on both sides
    } else if (lv === undefined) {
      resolved.set(key, rv);
      conflicts.push(`${path}: ${describe(key)} was deleted here but changed on GitHub — kept the GitHub version`);
    } else {
      resolved.set(key, lv);
      conflicts.push(`${path}: ${describe(key)} changed here and on GitHub — kept your version`);
    }
  }

  // Keep the branch's ordering for everything it knows about, then append what
  // only exists locally, so a merged file stays a small diff against the branch.
  const out: MergeRecord[] = [];
  const emitted = new Set<string>();
  const emit = (key: string) => {
    if (emitted.has(key)) {
      return;
    }
    const text = resolved.get(key);
    emitted.add(key);
    if (text !== undefined) {
      out.push({ key, text });
    }
  };
  for (const rec of remote) {
    emit(rec.key);
  }
  for (const rec of local) {
    emit(rec.key);
  }
  for (const key of resolved.keys()) {
    emit(key);
  }
  return { records: out, conflicts };
}

/** A record key as it should read in a conflict notice. */
function describe(key: string): string {
  if (key.startsWith('id:')) {
    return `task ${key.slice(3)}`;
  }
  if (key.startsWith('date:')) {
    return `the note for ${key.slice(5)}`;
  }
  if (key.startsWith('item:')) {
    return `"${key.replace(/^item:\d+:/, '')}"`;
  }
  if (key.startsWith('text:')) {
    return 'an entry';
  }
  return `the ${key} entry`;
}

/** Three-way pick for a single value: whichever side moved off the base wins,
 *  local when both did. */
function pick3<T>(base: T, local: T, remote: T): { value: T; conflict: boolean } {
  if (local === remote || remote === base) {
    return { value: local, conflict: false };
  }
  if (local === base) {
    return { value: remote, conflict: false };
  }
  return { value: local, conflict: true };
}

// ---- config.json ----------------------------------------------------------

type Json = Record<string, unknown>;

/** Merge config.json field by field, with the `clients` and `statuses` arrays
 *  merged by record id so two instances can add different clients. */
function mergeConfigJson(path: string, base: string, local: string, remote: string): MergeResult {
  let b: Json, l: Json, r: Json;
  try {
    b = base.trim() ? parseObject(base) : {};
    l = parseObject(local);
    r = parseObject(remote);
  } catch {
    return { text: local, conflicts: [`${path} changed here and on GitHub but could not be parsed — kept your version`] };
  }

  const conflicts: string[] = [];
  const merged: Json = {};
  const keys = new Set([...Object.keys(r), ...Object.keys(l)]);
  for (const key of keys) {
    const bv = b[key];
    const lv = l[key];
    const rv = r[key];
    if (isIdArray(lv) && isIdArray(rv)) {
      const toRecords = (arr: unknown): MergeRecord[] =>
        isIdArray(arr) ? arr.map((item) => ({ key: String(item.id), text: JSON.stringify(item) })) : [];
      const res = mergeRecords(`${path} (${key})`, toRecords(bv), toRecords(lv), toRecords(rv));
      merged[key] = res.records.map((rec) => JSON.parse(rec.text) as unknown);
      conflicts.push(...res.conflicts);
      continue;
    }
    const picked = pick3(json(bv), json(lv), json(rv));
    if (picked.conflict) {
      conflicts.push(`${path}: "${key}" changed here and on GitHub — kept your value`);
    }
    if (picked.value !== undefined) {
      merged[key] = JSON.parse(picked.value) as unknown;
    }
  }
  return { text: JSON.stringify(merged, null, 2) + '\n', conflicts };
}

function parseObject(text: string): Json {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('not an object');
  }
  return parsed as Json;
}

/** Stable string form of a value, so `pick3` can compare by value. */
function json(value: unknown): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}

function isIdArray(value: unknown): value is Array<{ id: unknown } & Json> {
  return Array.isArray(value) && value.every((item) => !!item && typeof item === 'object' && 'id' in (item as Json));
}
