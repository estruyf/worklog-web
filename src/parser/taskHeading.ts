// Owns the single rule that decides where a task block starts. The parser, the
// block helpers and (through them) the sync merge must all agree on it: if the
// writer thinks a block ends earlier than the reader does, an edit is written
// into a range that was never read. That is what a `## ` heading inside a
// description used to do — `replaceBlock` truncated the block at the heading,
// left the rest orphaned, and the freshly serialized description appended
// another copy of it on every single save.
//
// A `## ` heading opens a task only when the meta lines directly under it
// declare an `- id:`. That is the shape of every task block (README, "Expected
// repository layout") and the key the app edits, merges and archives on; a
// heading without one is prose in someone's description.

const H2 = /^##\s+/;
const META = /^-\s+[A-Za-z][\w-]*\s*:/;
const ID_META = /^-\s+id\s*:\s*(.+?)\s*$/;

/** Does line `index` open a task block? */
export function isTaskHeading(lines: string[], index: number): boolean {
  if (!H2.test(lines[index])) {
    return false;
  }
  // Walk the unbroken meta run under the heading. A blank line or any other
  // content ends it — the parser reads metadata the same way, so a heading whose
  // id sits past a blank line would not have had an id anyway.
  for (let i = index + 1; i < lines.length; i++) {
    if (ID_META.test(lines[i])) {
      return true;
    }
    if (!META.test(lines[i])) {
      return false;
    }
  }
  return false;
}
