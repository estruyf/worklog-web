// Pure, line-based parser for client and archive markdown files (see spec §3.2).
// markdown string -> structured Task records, and back. No I/O dependencies, so
// it is trivially unit-testable and reusable by both full and incremental paths.

import type { Task, TaskLink, TaskNote } from "../model/types";
import { isTaskHeading } from "./taskHeading";
import {
  formatRecurrence,
  parseRecurrence,
  type Recurrence,
  type RecurrenceAnchor,
} from "../model/recurrence";

export interface ParsedTaskFile {
  /** Display name from the `# H1`, if present. */
  displayName?: string;
  tasks: Task[];
}

/** Recurrence is spread over several `- repeat*:` lines, so the pieces are
 *  collected raw and assembled once the block ends — the lines may appear in
 *  any order. */
interface RepeatMeta {
  expr?: string;
  from?: string;
  until?: string;
}

type TaskDraft = Partial<Task> & { links: TaskLink[]; repeatMeta?: RepeatMeta };

const H1 = /^#\s+(.*)$/;
const H2 = /^##\s+(.*)$/;
const META = /^-\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/;
// Reserved sub-section (H3) that holds the task's chronological notes; kept out
// of the freeform description so the two can't clobber each other on round-trip.
const NOTES_HEADING = /^###\s+Notes\s*$/;
const NOTE_ENTRY =
  /^-\s+(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?)\s+—\s+(.*)$/;

/**
 * Parse a client/archive markdown file into tasks.
 * @param content   raw file text
 * @param sourceFile absolute path (stored for open-on-click)
 * @param clientId  canonical client id (filename stem / archive folder)
 */
export function parseTaskFile(
  content: string,
  sourceFile: string,
  clientId: string,
): ParsedTaskFile {
  const lines = content.split(/\r?\n/);
  const result: ParsedTaskFile = { tasks: [] };

  let current:
    | {
        task: TaskDraft;
        descLines: string[];
        line: number;
      }
    | undefined;
  let inMeta = false;

  const flush = () => {
    if (!current) {
      return;
    }
    const t = current.task;
    const { description, notes } = splitBody(current.descLines);
    result.tasks.push({
      id: t.id ?? "",
      title: (t.title ?? "").trim(),
      description,
      status: t.status ?? "open",
      priority: t.priority,
      parentId: t.parentId,
      clientIds: t.clientIds && t.clientIds.length ? t.clientIds : [clientId],
      links: t.links,
      attachments: t.attachments,
      created: t.created,
      due: t.due,
      completed: t.completed,
      repeat: buildRecurrence(t.repeatMeta),
      lastDone: t.lastDone,
      repeatOf: t.repeatOf,
      workedOn: t.workedOn,
      tags: t.tags,
      notes,
      sourceFile,
      sourceLine: current.line,
    });
    current = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // A `## ` heading without an id under it is description prose, not a new
    // task — see taskHeading.ts.
    const h2 = isTaskHeading(lines, i) ? H2.exec(line) : null;
    if (h2) {
      flush();
      current = {
        task: { title: h2[1], links: [], clientIds: [] },
        descLines: [],
        line: i,
      };
      inMeta = true;
      continue;
    }

    if (!current) {
      const h1 = H1.exec(line);
      if (h1 && result.displayName === undefined) {
        result.displayName = h1[1].trim();
      }
      continue;
    }

    if (inMeta) {
      const meta = META.exec(line);
      if (meta) {
        applyMeta(current.task, meta[1].toLowerCase(), meta[2].trim());
        continue;
      }
      // A blank line directly after the metadata block is the separator and is
      // not part of the description; once we hit a non-meta line, metadata ends.
      inMeta = false;
      if (line.trim() === "") {
        continue;
      }
    }

    current.descLines.push(line);
  }

  flush();
  return result;
}

/** Assemble the collected `- repeat*:` lines into a rule. An unrecognised
 *  expression yields no rule at all — the task stays a plain one-off rather than
 *  repeating on a guess. */
function buildRecurrence(meta: RepeatMeta | undefined): Recurrence | undefined {
  if (!meta?.expr) {
    return undefined;
  }
  const rec = parseRecurrence(meta.expr);
  if (!rec) {
    return undefined;
  }
  const anchor = parseAnchor(meta.from);
  if (anchor) {
    rec.anchor = anchor;
  }
  if (meta.until) {
    rec.until = meta.until;
  }
  return rec;
}

function parseAnchor(value: string | undefined): RecurrenceAnchor | undefined {
  switch (value?.trim().toLowerCase()) {
    case "completion":
    case "completed":
    case "done":
      return "completion";
    case "schedule":
    case "due":
      return "schedule";
    default:
      return undefined;
  }
}

function repeatMeta(task: TaskDraft): RepeatMeta {
  return (task.repeatMeta ??= {});
}

function applyMeta(task: TaskDraft, key: string, value: string): void {
  switch (key) {
    case "id":
      task.id = value;
      break;
    case "status":
      // Statuses are configurable; accept any non-empty id, default to 'open'.
      task.status = value || "open";
      break;
    case "priority":
      // Stored exactly as written, including a value off the scale: the app ranks
      // anything it doesn't recognise as normal (see model/priority) rather than
      // dropping a line the user typed. Absent means normal, so a blank clears it.
      task.priority = value || undefined;
      break;
    case "parent":
      task.parentId = value || undefined;
      break;
    case "link": {
      const link = parseLink(value);
      if (link) {
        task.links.push(link);
      }
      break;
    }
    case "attachment":
      // The whole value is the ref — attachment filenames may contain spaces,
      // so there is no label half to split off the way `link:` does.
      if (value) {
        (task.attachments ??= []).push(value);
      }
      break;
    case "created":
      task.created = value || undefined;
      break;
    case "due":
      task.due = value || undefined;
      break;
    case "completed":
      task.completed = value || undefined;
      break;
    case "repeat":
      repeatMeta(task).expr = value || undefined;
      break;
    case "repeatfrom":
      repeatMeta(task).from = value || undefined;
      break;
    case "repeatuntil":
      repeatMeta(task).until = value || undefined;
      break;
    case "lastdone":
      task.lastDone = value || undefined;
      break;
    case "repeatof":
      task.repeatOf = value || undefined;
      break;
    case "tags": {
      const tags = value
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      task.tags = tags.length ? tags : undefined;
      break;
    }
    case "worked": {
      if (!value) {
        break;
      }
      const dates = value
        .split(/[\s,]+/)
        .map((d) => d.trim())
        .filter(Boolean);
      if (dates.length === 0) {
        break;
      }
      const all = new Set([...(task.workedOn ?? []), ...dates]);
      task.workedOn = [...all].sort();
      break;
    }
    case "client":
      // Optional explicit client override; mainly for shared tasks.
      task.clientIds = value.split(/[,\s]+/).filter(Boolean);
      break;
    default:
      break; // unknown keys are ignored, not fatal
  }
}

function parseLink(value: string): TaskLink | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  // `link: <url>` or `link: <url> <label...>`
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) {
    return { url: trimmed };
  }
  return {
    url: trimmed.slice(0, spaceIdx),
    label: trimmed.slice(spaceIdx + 1).trim() || undefined,
  };
}

/**
 * Split a task's body (everything after the metadata block) into its freeform
 * description and its `### Notes` section. Lines before the notes heading are the
 * description; lines after are parsed into chronological note entries.
 */
function splitBody(lines: string[]): {
  description?: string;
  notes?: TaskNote[];
} {
  const notesStart = lines.findIndex((l) => NOTES_HEADING.test(l));
  if (notesStart === -1) {
    const description = lines.join("\n").trim();
    return { description: description || undefined };
  }
  const description = lines.slice(0, notesStart).join("\n").trim();
  const notes = parseNotes(lines.slice(notesStart + 1));
  return {
    description: description || undefined,
    notes: notes.length ? notes : undefined,
  };
}

/** Parse the lines of a `### Notes` section into timestamped entries. A new
 *  entry begins on each `- <timestamp> — <text>` line; following indented lines
 *  continue the current note's body. */
function parseNotes(lines: string[]): TaskNote[] {
  const notes: TaskNote[] = [];
  let current: { timestamp: string; text: string[] } | undefined;
  const flush = () => {
    if (current) {
      notes.push({
        timestamp: current.timestamp,
        text: current.text.join("\n").trim(),
      });
      current = undefined;
    }
  };
  for (const line of lines) {
    const m = NOTE_ENTRY.exec(line);
    if (m) {
      flush();
      current = { timestamp: m[1].replace("T", " "), text: [m[2]] };
    } else if (current) {
      // Continuation line of the current note; drop one list-indent level.
      current.text.push(line.replace(/^ {1,2}/, ""));
    }
    // Lines before the first entry (e.g. a blank separator) are ignored.
  }
  flush();
  return notes;
}

/** Serialize one note as a markdown list item, indenting continuation lines. */
function serializeNote(note: TaskNote): string {
  const [first = "", ...rest] = note.text.split(/\r?\n/);
  const head = `- ${note.timestamp} — ${first}`;
  const cont = rest.map((l) => (l.trim() ? `  ${l}` : ""));
  return [head, ...cont].join("\n");
}

/**
 * Serialize a single task back into its markdown block (heading + metadata +
 * description + notes). Used by capture commands so the round-trip is lossless.
 */
export function serializeTask(task: Task, clientId?: string): string {
  const out: string[] = [];
  out.push(`## ${task.title}`);
  out.push(`- id: ${task.id}`);
  out.push(`- status: ${task.status}`);
  // Directly under the status, and only when there is one: normal priority is the
  // absent line, so a repo whose owner never sets a priority never grows the field
  // — and never sees every task block rewritten to say so.
  if (task.priority) {
    out.push(`- priority: ${task.priority}`);
  }
  if (task.parentId) {
    out.push(`- parent: ${task.parentId}`);
  }
  // Only persist an explicit client line when the task is tagged to something
  // other than the file it lives in (shared tasks); avoids redundant metadata.
  if (
    clientId &&
    (task.clientIds.length > 1 ||
      (task.clientIds.length === 1 && task.clientIds[0] !== clientId))
  ) {
    out.push(`- client: ${task.clientIds.join(" ")}`);
  }
  for (const link of task.links) {
    out.push(`- link: ${link.label ? `${link.url} ${link.label}` : link.url}`);
  }
  for (const ref of task.attachments ?? []) {
    out.push(`- attachment: ${ref}`);
  }
  if (task.created) {
    out.push(`- created: ${task.created}`);
  }
  if (task.due) {
    out.push(`- due: ${task.due}`);
  }
  if (task.completed) {
    out.push(`- completed: ${task.completed}`);
  }
  if (task.repeat) {
    out.push(`- repeat: ${formatRecurrence(task.repeat)}`);
    // `schedule` is the default; only write the line when it differs.
    if (task.repeat.anchor === "completion") {
      out.push(`- repeatFrom: completion`);
    }
    if (task.repeat.until) {
      out.push(`- repeatUntil: ${task.repeat.until}`);
    }
  }
  if (task.lastDone) {
    out.push(`- lastDone: ${task.lastDone}`);
  }
  if (task.repeatOf) {
    out.push(`- repeatOf: ${task.repeatOf}`);
  }
  for (const worked of task.workedOn ?? []) {
    out.push(`- worked: ${worked}`);
  }
  if (task.tags && task.tags.length) {
    out.push(`- tags: ${task.tags.join(", ")}`);
  }
  const body: string[] = [];
  if (task.description && task.description.trim()) {
    body.push(task.description.trim());
  }
  if (task.notes && task.notes.length) {
    body.push(["### Notes", ...task.notes.map(serializeNote)].join("\n"));
  }
  if (body.length) {
    out.push("");
    out.push(body.join("\n\n"));
  }
  return out.join("\n");
}
