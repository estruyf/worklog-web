// Which clients a day is about, and the reference links they carry. Pure — no
// React — so the "relevant to this day" question is unit-testable on its own,
// which is the part that decides what the day view's links panel shows.
// See test/clientLinks.test.ts.

import type { Client, Task, TaskLink, WorklogEntry } from '../../model/types';
import { isEventWorklogClientId } from '../../model/worklog';
import { isGeneralTodoClientId } from '../../model/todos';
import { clientIdOf } from './task';

/** One client's reference links, ready to render. */
export interface ClientLinkGroup {
  id: string;
  name: string;
  color: string;
  links: TaskLink[];
}

/**
 * The clients a day is about: whoever booked time on it, plus whoever owns a
 * task the day's sections put on screen (`tasks` is those, concatenated).
 *
 * Event entries are not clients — they are how a day off or a holiday is booked
 * — and the general to-do bucket is a reserved pseudo-client rather than
 * somewhere work lives, so neither can pull a group onto the day.
 */
export function relevantDayClientIds(logs: WorklogEntry[], tasks: Task[]): Set<string> {
  const ids = new Set<string>();
  for (const l of logs) {
    if (!isEventWorklogClientId(l.clientId)) {
      ids.add(l.clientId);
    }
  }
  for (const t of tasks) {
    const id = clientIdOf(t);
    if (id && !isGeneralTodoClientId(id)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * The link groups for a set of client ids, in config order — the same order the
 * day's client sections come out in, so the two lists read down the page the
 * same way. Clients without links are dropped rather than rendered as a name
 * with nothing under it.
 *
 * Resolved against *every* client, archived included: time logged to a client
 * before it was retired still shows on that day, and its links are still where
 * that work lived.
 */
export function deriveClientLinks(
  clients: Client[],
  ids: ReadonlySet<string>,
  colorOf: (id: string) => string,
): ClientLinkGroup[] {
  return clients
    .filter((c) => ids.has(c.id) && (c.links?.length ?? 0) > 0)
    .map((c) => ({ id: c.id, name: c.name, color: colorOf(c.id), links: c.links ?? [] }));
}
