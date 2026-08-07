// Task priority: a fixed four-level scale, and deliberately unlike statuses.
// A status list is the user's workflow, which is why it is configurable; priority
// is an ordering, and orderings are the same everywhere. Keeping it fixed is what
// buys this module its size — no config key, no Settings editor, no config merge
// strategy, no orphan ids to list back.
//
// The middle of the scale is the *absence* of a `- priority:` line. Writing
// `- priority: normal` on every task would rewrite every block in the user's repo
// for a field they never set, so "normal" is what a task means when it says
// nothing, and only the other three are ever written.

/** A plain string id, like `TaskStatus` — the value comes out of Markdown the
 *  user can hand-edit, so it is whatever the file said, not a closed union. */
export type TaskPriority = string;

export interface PriorityDef {
  id: string;
  label: string;
  /** Sort position, most important first. `normal` sits in the middle, and is
   *  what an unset or unrecognised priority ranks as. */
  rank: number;
}

/** The id nothing writes: a task at normal priority carries no line at all. */
export const NORMAL_PRIORITY_ID = 'normal';

const NORMAL: PriorityDef = { id: NORMAL_PRIORITY_ID, label: 'Normal', rank: 2 };

/** The scale, most important first — the order every picker offers. */
export const PRIORITIES: PriorityDef[] = [
  { id: 'urgent', label: 'Urgent', rank: 0 },
  { id: 'high', label: 'High', rank: 1 },
  NORMAL,
  { id: 'low', label: 'Low', rank: 3 },
];

const BY_ID = new Map(PRIORITIES.map((p) => [p.id, p]));

/** The definition behind a raw `- priority:` value, matched case-insensitively
 *  so a hand-typed `High` reads as high without the file having to be rewritten.
 *  Undefined for anything the scale doesn't name: the value stays in the file
 *  (see `serializeTask`), the app just has no meaning to attach to it. */
export function priorityDef(raw: string | undefined): PriorityDef | undefined {
  return raw ? BY_ID.get(raw.trim().toLowerCase()) : undefined;
}

/** Where a task sorts. Unset and unrecognised both rank as normal — an absent
 *  priority is the middle of the scale, not the bottom of it, which is the one
 *  way this differs from the date sorts that push blanks to the end. */
export function priorityRank(raw: string | undefined): number {
  return (priorityDef(raw) ?? NORMAL).rank;
}

/** The bucket a task filters under. Unrecognised values fold into `normal`
 *  rather than becoming options of their own — there is no config to remove a
 *  priority from, so an id off the scale is a typo, not a retired setting. */
export function priorityBucket(raw: string | undefined): string {
  return (priorityDef(raw) ?? NORMAL).id;
}

/** What the app writes back: a canonical id, or nothing at all. Blank, `normal`
 *  and unrecognised values all clear the line.
 *
 *  The parser is deliberately more permissive than this. A file is the user's and
 *  keeps whatever it says; a form submission or a deeplink is ours to normalize. */
export function writablePriority(raw: string | undefined): string | undefined {
  const def = priorityDef(raw);
  return def && def.id !== NORMAL_PRIORITY_ID ? def.id : undefined;
}

/** True when a task's priority is worth a marker: known, and not normal. */
export function isMarkedPriority(raw: string | undefined): boolean {
  return writablePriority(raw) !== undefined;
}
