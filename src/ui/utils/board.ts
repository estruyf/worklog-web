// Which columns the status board draws, and in what order. Pure — the board
// itself only groups the rows it is handed into the columns this returns.
//
// Every task in the list has to land in a column, or the board hides work the
// list view shows. That is why this doesn't just walk the config: a status the
// user removed still lives in the Markdown of the tasks that were in it, so any
// status id the list actually carries gets a column of its own, after the
// configured ones. `orphanStatusIds` is the same rule stated for Settings.
//
// The terminal status is last and flagged, because the board treats it as a
// place and the app treats it as an event: dropping a card there closes the
// task, which archives it and cascades to its open subtasks. The board routes
// that through the same path the tick does, toast and Undo included, and fills
// the column with what has recently been closed — otherwise it would be a hole
// cards fall into.

import type { StatusDef } from '../../model/types';
import { resolveStatusMeta } from './status';

/** How many closed tasks the terminal column shows before the rest is the
 *  archive's business. A board is what is in play; the whole history of a client
 *  in one column would bury the columns that are. */
export const BOARD_DONE_LIMIT = 20;

export interface BoardColumn {
  id: string;
  /** The status as its owner typed it: a column heading is read, not shouted. */
  name: string;
  color: string;
  /** The closing status. Set on exactly one column, always the last. */
  terminal?: boolean;
}

export function boardColumns(statuses: StatusDef[], tasks: { status: string }[]): BoardColumn[] {
  const toColumn = (def: StatusDef | undefined, id: string, done = false): BoardColumn => {
    const meta = resolveStatusMeta(def, id, done);
    return { id, name: meta.name, color: meta.color, terminal: done || undefined };
  };

  const working = statuses.filter((s) => !s.terminal).map((s) => toColumn(s, s.id));
  const terminal = statuses.find((s) => s.terminal);
  // Ids the tasks carry that neither half accounts for — a status removed from
  // the config while tasks were still sitting in it.
  const covered = new Set([...working.map((c) => c.id), ...(terminal ? [terminal.id] : [])]);
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const extra = [...new Set(tasks.map((t) => t.status).filter((id) => id && !covered.has(id)))].sort();

  return [
    ...working,
    ...extra.map((id) => toColumn(byId.get(id), id)),
    // Last, whatever the leftovers did — it is where a task stops, and a column
    // after it would read as somewhere further to go.
    ...(terminal ? [toColumn(terminal, terminal.id, true)] : []),
  ];
}
