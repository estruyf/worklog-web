// The Markdown edits behind the formatting toolbar and its shortcuts: what ⌘B
// does to a selection, what Enter does at the end of a list item. Pure, and
// tested here — the interaction (reading the caret off a textarea, putting it
// back after React re-renders) lives in `components/markdown-format`.
//
// Every function returns the text *and* where the selection lands. An edit that
// leaves the caret at the wrong offset is one the next keystroke undoes, so the
// two are never separate results.

/** Text after the edit, with the selection to restore on top of it. */
export interface MarkdownEdit {
  text: string;
  start: number;
  end: number;
}

/** The inline markers a toggle wraps a selection in. */
export type WrapMarker = '**' | '*' | '`' | '~~';

/** The block markers a toggle puts at the head of every selected line. */
export type LinePrefix = 'bullet' | 'ordered' | 'task' | 'quote';

const LINE_MARKER: Record<LinePrefix, RegExp> = {
  // A task item is a bullet with a box on it, so it must not read as one here:
  // pressing Bullet on `- [ ] x` is a request to drop the box, not a no-op.
  bullet: /^([ \t]*)[-*+][ \t]+(?!\[[ xX]\][ \t])/,
  ordered: /^([ \t]*)\d+[.)][ \t]+/,
  task: /^([ \t]*)[-*+][ \t]+\[[ xX]\][ \t]+/,
  quote: /^([ \t]*)>[ \t]?/,
};

/** Any list marker, whichever kind — what switching kinds replaces. */
const ANY_LIST = /^([ \t]*)(?:[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)/;

/** Word characters, for the selection ⌘B expands to when there is none. */
const WORD = /[\p{L}\p{N}_]/u;

const lineStart = (text: string, at: number): number => (at <= 0 ? 0 : text.lastIndexOf('\n', at - 1) + 1);

const lineEnd = (text: string, at: number): number => {
  const nl = text.indexOf('\n', at);
  return nl < 0 ? text.length : nl;
};

/**
 * With nothing selected, format the word the caret is in — the whole point of
 * ⌘B is not having to select first. A caret in whitespace stays a caret, and
 * gets an empty pair to type into.
 */
function expandToWord(text: string, start: number, end: number): [number, number] {
  if (start !== end) {
    return [start, end];
  }
  let s = start;
  let e = end;
  while (s > 0 && WORD.test(text[s - 1])) {
    s--;
  }
  while (e < text.length && WORD.test(text[e])) {
    e++;
  }
  return [s, e];
}

/** How many `*` a string opens (`leading`) or closes with. */
function starRun(text: string, leading: boolean): number {
  return (leading ? /^\*+/ : /\*+$/).exec(text)?.[0].length ?? 0;
}

/**
 * A fenced block around whole lines, or the fence taken back off. Reached from
 * {@link toggleWrap} when Code is pressed on a selection that spans lines: a
 * single backtick around a newline is not code, it is two stray backticks.
 */
function toggleFence(text: string, start: number, end: number): MarkdownEdit {
  const from = lineStart(text, start);
  const to = lineEnd(text, end);
  const block = text.slice(from, to);
  const fenced = /^```[^\n]*\n([\s\S]*)\n```$/.exec(block);
  const inner = fenced ? fenced[1] : '```\n' + block + '\n```';
  const offset = fenced ? 0 : 4;
  return {
    text: text.slice(0, from) + inner + text.slice(to),
    start: from + offset,
    end: from + offset + (fenced ? inner.length : block.length),
  };
}

/**
 * Put `marker` around the selection, or take it back off when it is already
 * there — on either side of the selection, since selecting the word inside
 * `**bold**` is the same request as selecting the whole thing.
 */
export function toggleWrap(text: string, start: number, end: number, marker: WrapMarker): MarkdownEdit {
  if (marker === '`' && text.slice(start, end).includes('\n')) {
    return toggleFence(text, start, end);
  }
  const [s, e] = expandToWord(text, start, end);
  const len = marker.length;
  const sel = text.slice(s, e);
  // A run of exactly two stars is bold's, and italic has none of its own to take
  // off there: ⌘I on a word inside `**bold**` has to produce ***both***, while
  // on one inside `***both***` it takes back only the third star.
  const italic = (lead: number, trail: number) => marker !== '*' || (lead !== 2 && trail !== 2);

  if (
    sel.length >= len * 2 &&
    sel.startsWith(marker) &&
    sel.endsWith(marker) &&
    italic(starRun(sel, true), starRun(sel, false))
  ) {
    const inner = sel.slice(len, -len);
    return { text: text.slice(0, s) + inner + text.slice(e), start: s, end: s + inner.length };
  }
  if (
    text.slice(s - len, s) === marker &&
    text.slice(e, e + len) === marker &&
    italic(starRun(text.slice(e), true), starRun(text.slice(0, s), false))
  ) {
    return { text: text.slice(0, s - len) + sel + text.slice(e + len), start: s - len, end: e - len };
  }
  return {
    text: text.slice(0, s) + marker + sel + marker + text.slice(e),
    start: s + len,
    end: s + len + sel.length,
  };
}

function markerFor(kind: LinePrefix, n: number): string {
  return kind === 'ordered' ? `${n}. ` : kind === 'task' ? '- [ ] ' : kind === 'quote' ? '> ' : '- ';
}

function addPrefix(line: string, kind: LinePrefix, n: number): string {
  // A quote sits outside whatever the line already is — `> - item` is a quoted
  // list, and toggling one must not eat the other. The three list kinds are
  // alternatives to each other, so each replaces the marker already there.
  if (kind === 'quote') {
    return '> ' + line;
  }
  const m = ANY_LIST.exec(line);
  const indent = m ? m[1] : (/^[ \t]*/.exec(line) as RegExpExecArray)[0];
  return indent + markerFor(kind, n) + line.slice(m ? m[0].length : indent.length);
}

/**
 * Toggle a block marker over every line the selection touches. Already-marked
 * throughout means "take it off"; anything else means "put it on", so a partly
 * marked selection ends up whole rather than inverted line by line.
 */
export function toggleLinePrefix(text: string, start: number, end: number, kind: LinePrefix): MarkdownEdit {
  const from = lineStart(text, start);
  // A selection that ends on a line break stops at the line above it: the next
  // line was never shown as selected, and marking it would be a surprise.
  const to = lineEnd(text, end > start && text[end - 1] === '\n' ? end - 1 : end);
  const lines = text.slice(from, to).split('\n');
  const filled = lines.filter((l) => l.trim() !== '');
  const on = filled.length > 0 && filled.every((l) => LINE_MARKER[kind].test(l));

  let n = 0;
  const next = lines.map((line) => {
    if (on) {
      return line.replace(LINE_MARKER[kind], '$1');
    }
    // Blank lines are numbered too — an empty field with the caret in it is the
    // ordinary way a list gets started, and it is one blank line.
    n += 1;
    return addPrefix(line, kind, n);
  });

  const head = next[0].length - lines[0].length;
  const all = next.join('\n').length - (to - from);
  // A selection that already began at the line's text keeps that edge, so the
  // marker being added lands inside it and the line still reads as selected. A
  // caret moves with the marker instead — on an empty line that is the whole
  // point, since it is what leaves the caret after the `- ` to type into.
  const indent = from + ((/^[ \t]*/.exec(lines[0]) as RegExpExecArray)[0].length);
  const at = start === end || start > indent ? Math.max(from, start + head) : start;
  return { text: text.slice(0, from) + next.join('\n') + text.slice(to), start: at, end: Math.max(at, end + all) };
}

/** A selection that is already a URL becomes the target rather than the label. */
const URL_LIKE = /^(?:https?:\/\/|mailto:|www\.)\S+$/i;

/**
 * `[label](url)` around the selection, with the caret left in whichever half is
 * still empty. Neither half is filled with a placeholder: a `[text](url)` nobody
 * finished is broken Markdown that looks finished.
 */
export function insertLink(text: string, start: number, end: number): MarkdownEdit {
  const sel = text.slice(start, end);
  const url = URL_LIKE.test(sel.trim()) ? sel.trim() : '';
  const label = url ? '' : sel;
  const caret = label ? start + label.length + 3 : start + 1;
  return { text: text.slice(0, start) + `[${label}](${url})` + text.slice(end), start: caret, end: caret };
}

/** The marker a line carries, and the one the line after it should get. */
function listLead(line: string): { lead: string; next: string } | null {
  const quote = /^[ \t]*>[ \t]?/.exec(line);
  if (quote) {
    return { lead: quote[0], next: quote[0] };
  }
  // Checked or not, the item Enter opens is a fresh one: `[ ]`.
  const task = /^([ \t]*[-*+][ \t]+)\[[ xX]\]([ \t]+)/.exec(line);
  if (task) {
    return { lead: task[0], next: `${task[1]}[ ]${task[2]}` };
  }
  const ordered = /^([ \t]*)(\d+)([.)][ \t]+)/.exec(line);
  if (ordered) {
    return { lead: ordered[0], next: `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]}` };
  }
  const bullet = /^[ \t]*[-*+][ \t]+/.exec(line);
  return bullet ? { lead: bullet[0], next: bullet[0] } : null;
}

/**
 * Enter inside a list: carry the marker onto the next line, the way every editor
 * that knows about lists does. `null` means this line is not one — the caller
 * lets the browser insert an ordinary newline.
 *
 * Enter on an *empty* item ends the list instead of writing a marker nobody
 * asked for, which is the only way out of one without deleting by hand.
 */
export function continueList(text: string, caret: number): MarkdownEdit | null {
  const from = lineStart(text, caret);
  const to = lineEnd(text, caret);
  const line = text.slice(from, to);
  const lead = listLead(line);
  // A caret still inside the marker is being typed, not being continued.
  if (!lead || caret < from + lead.lead.length) {
    return null;
  }
  if (line.slice(lead.lead.length).trim() === '') {
    return { text: text.slice(0, from) + text.slice(to), start: from, end: from };
  }
  const insert = '\n' + lead.next;
  return { text: text.slice(0, caret) + insert + text.slice(caret), start: caret + insert.length, end: caret + insert.length };
}
