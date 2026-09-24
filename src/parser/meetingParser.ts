// Pure parser + serializer for meeting files, `meetings/<YYYY-MM>.md`.
//
// A meeting block is shaped like a task block on purpose — a `## ` title, an
// unbroken run of `- key: value` lines with an `- id:` among them, then Markdown —
// so `isTaskHeading` is the one rule for where a block starts, and the sync merge
// and the block helpers in `blocks.ts` work on these files unchanged.
//
// The action items are a reserved `### Action items` section, but only when it is
// the *last* thing in the block and holds nothing but checkbox lines. Anything
// else under that heading is the user's prose, and reading it as items would drop
// it on the next save. Same bargain as the day-note heading rule: narrow enough
// that a hand-edited file never loses a line.

import type { Meeting, MeetingAction } from '../model/types';
import { isTaskHeading } from './taskHeading';
import { splitTaskBlocks } from './blocks';

const H2 = /^##\s+(.*)$/;
const META = /^-\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/;
const ACTIONS_HEADING = /^###\s+Action items\s*$/i;
const ACTION_ENTRY = /^-\s+\[([ xX])\]\s*(.*)$/;
// The task an item became, written after an arrow so the line still reads as a
// sentence in a plain Markdown viewer.
const ACTION_TASK = /^(.*?)\s+→\s+(t_[A-Za-z0-9]+)$/;
const TIME = /^(\d{1,2}):(\d{2})$/;
const DURATION = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/i;

/** `45m`, `1h`, `1h30m`, `1.5h`, or a bare number of minutes → minutes. */
export function parseDuration(value: string): number | undefined {
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n > 0 ? n : undefined;
  }
  const m = DURATION.exec(text);
  if (!m || (!m[1] && !m[2])) {
    return undefined;
  }
  const minutes = Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0));
  return minutes > 0 ? minutes : undefined;
}

/** Minutes → the form the file stores: `45m`, `1h`, `1h30m`. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/** "9:05" → "09:05"; anything that isn't a clock time → undefined. */
export function normalizeTime(value: string): string | undefined {
  const m = TIME.exec(value.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    return undefined;
  }
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Parse a meetings file into one record per block. A block with no id is kept
 *  out: it is prose that happens to look like a heading, and nothing could edit it. */
export function parseMeetingFile(content: string, sourceFile: string): Meeting[] {
  const lines = content.split(/\r?\n/);
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTaskHeading(lines, i)) {
      starts.push(i);
    }
  }
  const meetings: Meeting[] = [];
  for (let b = 0; b < starts.length; b++) {
    const end = b + 1 < starts.length ? starts[b + 1] : lines.length;
    const meeting = parseBlock(lines.slice(starts[b], end), sourceFile, starts[b]);
    if (meeting.id) {
      meetings.push(meeting);
    }
  }
  return meetings;
}

function parseBlock(lines: string[], sourceFile: string, line: number): Meeting {
  const meeting: Meeting = {
    id: '',
    title: (H2.exec(lines[0])?.[1] ?? '').trim(),
    date: '',
    people: [],
    notes: '',
    actions: [],
    sourceFile,
    sourceLine: line,
  };
  let i = 1;
  for (; i < lines.length; i++) {
    const meta = META.exec(lines[i]);
    if (!meta) {
      break;
    }
    const value = meta[2].trim();
    switch (meta[1].toLowerCase()) {
      case 'id':
        meeting.id = value;
        break;
      case 'date':
        meeting.date = value;
        break;
      case 'time':
        meeting.time = normalizeTime(value) ?? meeting.time;
        break;
      case 'duration':
        meeting.duration = parseDuration(value) ?? meeting.duration;
        break;
      case 'client':
        meeting.clientId = value || undefined;
        break;
      case 'people':
        meeting.people = splitPeople(value);
        break;
    }
  }
  const body = trimBlank(lines.slice(i));
  const at = actionsStart(body);
  if (at < 0) {
    meeting.notes = body.join('\n');
  } else {
    meeting.notes = trimBlank(body.slice(0, at)).join('\n');
    meeting.actions = body
      .slice(at + 1)
      .filter((l) => l.trim() !== '')
      .map(parseAction);
  }
  return meeting;
}

/** Index of the `### Action items` heading that owns the rest of the body, or -1. */
function actionsStart(body: string[]): number {
  for (let i = body.length - 1; i >= 0; i--) {
    if (ACTIONS_HEADING.test(body[i])) {
      return body.slice(i + 1).every((l) => l.trim() === '' || ACTION_ENTRY.test(l)) ? i : -1;
    }
  }
  return -1;
}

function parseAction(line: string): MeetingAction {
  const m = ACTION_ENTRY.exec(line)!;
  const done = m[1] !== ' ';
  const linked = ACTION_TASK.exec(m[2].trim());
  return linked ? { text: linked[1].trim(), done, taskId: linked[2] } : { text: m[2].trim(), done };
}

/** Comma-separated names, blanks and repeats dropped (case-insensitively — "sam"
 *  and "Sam" are one person typed twice, not two people). */
export function splitPeople(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(',')) {
    const name = raw.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

function trimBlank(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') {
    start++;
  }
  while (end > start && lines[end - 1].trim() === '') {
    end--;
  }
  return lines.slice(start, end);
}

/** One meeting as its block text, no trailing newline. */
export function serializeMeeting(m: Meeting): string {
  const out = [`## ${m.title}`, `- id: ${m.id}`, `- date: ${m.date}`];
  if (m.time) {
    out.push(`- time: ${m.time}`);
  }
  if (m.duration) {
    out.push(`- duration: ${formatDuration(m.duration)}`);
  }
  if (m.clientId) {
    out.push(`- client: ${m.clientId}`);
  }
  if (m.people.length) {
    out.push(`- people: ${m.people.join(', ')}`);
  }
  const notes = trimBlank(m.notes.split(/\r?\n/)).join('\n');
  if (notes) {
    out.push('', notes);
  }
  if (m.actions.length) {
    out.push('', '### Action items');
    for (const a of m.actions) {
      out.push(`- [${a.done ? 'x' : ' '}] ${a.text}${a.taskId ? ` → ${a.taskId}` : ''}`);
    }
  }
  return out.join('\n');
}

/** The canonical file for a header and a set of block texts. The sync merge joins
 *  through this too, so a merge that changes nothing writes back the same bytes
 *  rather than a whitespace diff that shows up as a phantom commit. */
export function joinMeetingFile(header: string, blocks: readonly string[]): string {
  const head = header.replace(/\s+$/, '');
  const body = blocks.map((b) => b.replace(/\s+$/, '')).join('\n\n');
  if (!body) {
    return head ? `${head}\n` : '';
  }
  return head ? `${head}\n\n${body}\n` : `${body}\n`;
}

/** Insert or replace one meeting's block, returning the file's new content.
 *
 *  A new block goes in date-and-time order, but what is already there is never
 *  re-sorted: the merge keeps the branch's record order, and re-sorting here would
 *  have two instances shuffling one file back and forth. */
export function upsertMeeting(content: string | undefined, month: string, meeting: Meeting): string {
  const { header, blocks } = splitTaskBlocks(content ?? '');
  const text = serializeMeeting(meeting);
  const at = blocks.findIndex((b) => b.id === meeting.id);
  const texts = blocks.map((b) => b.text);
  if (at >= 0) {
    texts[at] = text;
  } else {
    const key = sortKey(meeting);
    const parsed = parseMeetingFile(content ?? '', '');
    const byId = new Map(parsed.map((m) => [m.id, sortKey(m)]));
    const before = blocks.findIndex((b) => b.id !== undefined && (byId.get(b.id) ?? '') > key);
    texts.splice(before < 0 ? texts.length : before, 0, text);
  }
  return joinMeetingFile(header || `# Meetings ${month}`, texts);
}

/** The file without one meeting's block. The file itself stays even when it
 *  empties, the same choice the day notes make — see `upsertDayNote`. */
export function removeMeeting(content: string, id: string): string {
  const { header, blocks } = splitTaskBlocks(content);
  return joinMeetingFile(
    header,
    blocks.filter((b) => b.id !== id).map((b) => b.text),
  );
}

function sortKey(m: Pick<Meeting, 'date' | 'time'>): string {
  return `${m.date} ${m.time ?? ''}`;
}
