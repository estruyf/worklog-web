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
