// Task cross-references — `#t_a1b2c3` in a description or a note, the way an
// issue links another issue. Pure: the syntax itself, whether the caret is
// sitting in one being typed, and what picking a task writes back. The renderer
// resolves refs to titles (`./markdown`) and the picker inserts them
// (`components/task-mention`); neither owns the rules.
//
// The stored form is the bare id and nothing else. A title written alongside it
// would be a copy that goes stale the moment the task is renamed, and this text
// is the user's Markdown — one canonical spelling keeps it hand-editable.

import type { Task } from '../../model/types';
import { isDone } from './task';

/** A ref as stored: `#` + a task id (`parser/ids.ts` writes `t_` + base36). */
export const TASK_REF = /#(t_[a-z0-9]+)/g;

/** The `#…` being typed at the caret. `end` is the caret; `start` is the `#`. */
export interface TaskMentionQuery {
  start: number;
  end: number;
  /** Everything after the `#` — matched against titles and ids. */
  query: string;
}

/**
 * A query long enough to be a sentence is a sentence: past this the `#` the user
 * typed two lines ago stops being a mention and goes back to being text.
 */
const MAX_QUERY = 40;

/**
 * Inside a code span or a fenced block, counted from the start of the text.
 * `#` means nothing there — the renderer leaves code alone — so the picker must
 * not offer to write a ref the preview would show verbatim.
 */
function inCode(text: string, index: number): boolean {
  const lines = text.slice(0, index).split('\n');
  const current = lines.pop() ?? '';
  const fences = lines.filter((l) => /^\s*```/.test(l)).length;
  if (fences % 2 === 1) {
    return true;
  }
  // An odd number of backticks before the caret leaves a span open.
  return (current.split('`').length - 1) % 2 === 1;
}

/**
 * The mention the caret is in, or `null`. Deliberately conservative — every
 * `#` in Markdown that isn't a ref must keep working:
 *
 * - `# Heading` and `## Heading` — a query never starts with whitespace, and a
 *   `#` run is not a mention either.
 * - `https://example.com#anchor`, `foo#bar` — the `#` has to open a word.
 * - `` `#t_a1b2c3` `` — code is left alone.
 * - `#t_a1b2c3 ` — a *finished* ref is not a query any more, which is what stops
 *   the list from reopening on the space the picker itself just wrote.
 */
export function mentionAt(text: string, caret: number): TaskMentionQuery | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf('#');
  if (start < 0) {
    return null;
  }
  const query = before.slice(start + 1);
  if (query.length > MAX_QUERY || /[\n`]/.test(query) || /^[\s#]/.test(query)) {
    return null;
  }
  if (/^t_[a-z0-9]+[^a-z0-9]/.test(query)) {
    return null;
  }
  const prev = start > 0 ? text[start - 1] : '';
  if (prev && !/[\s([{<>"'-]/.test(prev)) {
    return null;
  }
  return inCode(text, start) ? null : { start, end: caret, query };
}

/**
 * Replace the mention with `#<id>`, and report where the caret lands. The
 * trailing space is what makes the ref finished rather than still-being-typed
 * (see {@link mentionAt}), so it is only skipped when there is already one.
 */
export function applyMention(text: string, mention: TaskMentionQuery, taskId: string): { text: string; caret: number } {
  const rest = text.slice(mention.end);
  const ref = `#${taskId}` + (/^\s/.test(rest) ? '' : ' ');
  return { text: text.slice(0, mention.start) + ref + rest, caret: mention.start + ref.length };
}

/** How many tasks the picker offers at once — a list you scan, not one you scroll. */
const MAX_MATCHES = 8;

/**
 * The tasks a `#` query offers, best first: open before done (a closed task can
 * still be referenced, but it is rarely the one meant), then a title that starts
 * with the query before one that merely contains it. Matching the id too is what
 * makes a pasted `#t_a1b2c3` resolvable without knowing the title.
 *
 * `exclude` is the task being written, which cannot usefully reference itself.
 * The per-occurrence snapshots a recurring task leaves in the archive are left
 * out too: they are a record of one tick, and the task anyone means to link is
 * the recurring one they came from.
 */
export function matchTaskRefs(tasks: Task[], query: string, exclude?: string, limit = MAX_MATCHES): Task[] {
  const needle = query.trim().toLowerCase();
  const hits = tasks.filter(
    (t) =>
      t.id !== exclude &&
      !t.repeatOf &&
      (!needle || t.title.toLowerCase().includes(needle) || t.id.includes(needle)),
  );
  const rank = (t: Task) => (isDone(t) ? 2 : 0) + (needle && t.title.toLowerCase().startsWith(needle) ? 0 : 1);
  // Stable, so tasks of equal rank keep the order the store hands them out in.
  return hits.sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}
