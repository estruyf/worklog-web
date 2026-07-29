// Pure helpers for locating and removing a single task's markdown block by id.
// Used by capture commands (close/move). Operating by id (not line number) keeps
// edits correct even if surrounding content shifted.

export interface ExtractedBlock {
  /** The full `## ...` block text (no trailing newline). */
  block: string;
  /** File content with the block (and its surrounding blank lines) removed. */
  remainder: string;
  /** 0-based line index of the block's `## ` heading. */
  startLine: number;
}

const H2 = /^##\s+/;
const ID_META = /^-\s+id\s*:\s*(.+?)\s*$/;

/** One `## ` block of a task file, with its id if it declares one. */
export interface TaskBlock {
  /** The `- id:` value, when the block has one. */
  id?: string;
  /** The block text, trailing blank lines trimmed. */
  text: string;
}

/** Split a task file into its leading header (everything before the first `## `)
 *  and its task blocks. Used by the sync merge, which reconciles two versions of
 *  a file block by block rather than line by line. */
export function splitTaskBlocks(content: string): { header: string; blocks: TaskBlock[] } {
  const lines = content.split(/\r?\n/);
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (H2.test(lines[i])) {
      starts.push(i);
    }
  }
  const header = lines.slice(0, starts.length ? starts[0] : lines.length).join('\n').replace(/\s+$/, '');
  const blocks: TaskBlock[] = [];
  for (let b = 0; b < starts.length; b++) {
    const end = b + 1 < starts.length ? starts[b + 1] : lines.length;
    const blockLines = lines.slice(starts[b], end);
    while (blockLines.length && blockLines[blockLines.length - 1].trim() === '') {
      blockLines.pop();
    }
    let id: string | undefined;
    for (const line of blockLines) {
      const m = ID_META.exec(line);
      if (m) {
        id = m[1];
        break;
      }
    }
    blocks.push({ id, text: blockLines.join('\n') });
  }
  return { header, blocks };
}

/** Find the [startLine, endLine) range of the task block with the given id. */
export function findBlockRange(content: string, taskId: string): { start: number; end: number } | undefined {
  const lines = content.split(/\r?\n/);
  let blockStart = -1;
  let matched = false;
  const ranges: { start: number; end: number; matched: boolean }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (H2.test(lines[i])) {
      if (blockStart !== -1) {
        ranges.push({ start: blockStart, end: i, matched });
      }
      blockStart = i;
      matched = false;
    } else if (blockStart !== -1) {
      const m = ID_META.exec(lines[i]);
      if (m && m[1] === taskId) {
        matched = true;
      }
    }
  }
  if (blockStart !== -1) {
    ranges.push({ start: blockStart, end: lines.length, matched });
  }

  const hit = ranges.find((r) => r.matched);
  return hit ? { start: hit.start, end: hit.end } : undefined;
}

/** Replace a task block (by id) with new text, in place. Returns undefined if
 *  the id is not present. */
export function replaceBlock(content: string, taskId: string, newBlock: string): string | undefined {
  const range = findBlockRange(content, taskId);
  if (!range) {
    return undefined;
  }
  const lines = content.split(/\r?\n/);
  // Preserve a trailing blank separator if the original block had one.
  const original = lines.slice(range.start, range.end);
  const hadTrailingBlank = original.length > 0 && original[original.length - 1].trim() === '';
  const replacement = newBlock.split(/\r?\n/);
  if (hadTrailingBlank) {
    replacement.push('');
  }
  const next = [...lines.slice(0, range.start), ...replacement, ...lines.slice(range.end)];
  return next.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Extract and remove a task block by id, collapsing leftover blank lines. */
export function extractBlock(content: string, taskId: string): ExtractedBlock | undefined {
  const range = findBlockRange(content, taskId);
  if (!range) {
    return undefined;
  }
  const lines = content.split(/\r?\n/);
  const blockLines = lines.slice(range.start, range.end);
  // Trim trailing blank lines off the captured block.
  while (blockLines.length && blockLines[blockLines.length - 1].trim() === '') {
    blockLines.pop();
  }

  const before = lines.slice(0, range.start);
  const after = lines.slice(range.end);
  // Drop one blank-line separator that preceded the block, if any.
  while (before.length && before[before.length - 1].trim() === '') {
    before.pop();
  }
  const remainderLines = [...before];
  if (before.length && after.some((l) => l.trim() !== '')) {
    remainderLines.push('');
  }
  remainderLines.push(...after);

  let remainder = remainderLines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  if (remainder) {
    remainder += '\n';
  }
  return { block: blockLines.join('\n'), remainder, startLine: range.start };
}
