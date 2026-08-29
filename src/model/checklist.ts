// Reusable checklists: a packing list, a release routine, the steps of an
// invoice run. The thing a checklist has that a task doesn't is that it is *run
// again* — you tick through it, start it over, and the items are still there for
// next time.
//
// Deliberately not tasks. A checklist item has no client, no due date, no status
// and no worked-on days: it never reaches the ledger, the day view or billing.
// That is the whole distinction — a release checklist is how you remember the
// steps, not where you log the hours.

/** One tickable line. `line` is where it sits in the file, which is what lets an
 *  edit rewrite exactly that line and leave everything a person hand-wrote — a
 *  paragraph, a nested bullet, an image — untouched. */
export interface ChecklistItem {
  text: string;
  done: boolean;
  /** 0-based line of the `- [ ]` in the source file. */
  line: number;
}

/** A `## ` group within a list. A list written without headings has exactly one
 *  section with no title, so every reader can treat sections as the only shape. */
export interface ChecklistSection {
  title?: string;
  /** 0-based line of the `## ` heading; absent on the untitled leading section. */
  line?: number;
  items: ChecklistItem[];
}

export interface Checklist {
  /** The filename stem — `lists/<id>.md`. */
  id: string;
  /** The `# ` heading. */
  name: string;
  /** The day the list was last started over (YYYY-MM-DD), from `- last run:`.
   *  Absent on a list that has never been run through. */
  lastRun?: string;
  sections: ChecklistSection[];
  sourceFile: string;
}

/** Every item in the list, in file order. */
export function checklistItems(list: Checklist): ChecklistItem[] {
  return list.sections.flatMap((s) => s.items);
}

/** How far through a run the list is. */
export function checklistProgress(list: Checklist): { done: number; total: number } {
  const items = checklistItems(list);
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** A file-name id for a new list's name: lowercase, dashes, ASCII-safe.
 *  Falls back to `list` so a name of pure punctuation still produces a path. */
export function checklistSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'list';
}

/** `checklistSlug`, made unique against the ids already in use — a second
 *  "Packing" becomes `packing-2` rather than overwriting the first one's file. */
export function uniqueChecklistId(name: string, taken: readonly string[]): string {
  const base = checklistSlug(name);
  if (!taken.includes(base)) {
    return base;
  }
  let n = 2;
  while (taken.includes(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}
