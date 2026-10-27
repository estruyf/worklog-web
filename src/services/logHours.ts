// "I spent 4 hours on Acme today", recorded from outside the app — behind the
// CLI's `hours` command. Time is tracked per client (or day event) per day, not
// per task, so this sets that one ledger line: the same write the day editor's
// Save makes, under the same rules (model/worklog).
//
// Setting rather than adding is what keeps it idempotent: the CLI replays it
// after a lost push race, and a second identical run must change nothing.

import { Store } from '../store';
import type { WorklogEntry } from '../model/types';
import {
  EVENT_TYPES,
  eventLabel,
  eventTypeFromClientId,
  eventWorklogClientId,
  isEventWorklogClientId,
  resolveHours,
  roundHours,
  unloggableReason,
} from '../model/worklog';
import { setWorklog } from './worklog';
import { today } from '../util/date';

export interface LogHoursInput {
  /** A client id, or… */
  clientId?: string;
  /** …a day event (vacation, sick, …). Exactly one of the two. */
  event?: string;
  /** `full`, `half`, or a number of hours. 0 removes the line. */
  hours: string | number;
  /** Replaces the line's note. Left out, the note already there is kept. */
  note?: string;
  /** Defaults to today. */
  date?: string;
}

export interface LogHoursResult {
  /** The ledger id written: a client id or `event:<type>`. */
  target: string;
  date: string;
  hours: number;
  /** The line as it was before, if there was one. */
  previous?: WorklogEntry;
  changed: boolean;
  /** Everything logged that day after the write, against the working day. */
  dayTotal: number;
  hoursPerDay: number;
}

export async function logHours(store: Store, input: LogHoursInput): Promise<LogHoursResult> {
  const config = store.getConfig();
  const date = input.date ?? today();
  if (!!input.clientId === !!input.event) {
    throw new Error('Name either a client or a day event.');
  }

  let target: string;
  if (input.event) {
    target = eventWorklogClientId(input.event);
    if (!EVENT_TYPES.some((e) => e.id === eventTypeFromClientId(target))) {
      throw new Error(`Unknown day event "${input.event}". Known: ${EVENT_TYPES.map((e) => e.id).join(', ')}.`);
    }
  } else {
    target = input.clientId as string;
    const reason = unloggableReason(store.db.getClients(), target);
    if (reason) {
      throw new Error(reason);
    }
  }

  const hours = resolveHours(input.hours, config.hoursPerDay);
  if (hours === undefined) {
    throw new Error(`Hours must be full, half or a number, got "${input.hours}".`);
  }

  const previous = dayEntries(store, date).find((e) => e.clientId === target);
  const note = input.note !== undefined ? input.note.trim() || undefined : previous?.note;
  const changed = hours > 0 ? previous?.hours !== hours || previous?.note !== note : !!previous;
  if (changed) {
    await setWorklog(store, date, target, hours, note);
  }

  return {
    target,
    date,
    hours,
    previous,
    changed,
    dayTotal: roundHours(dayEntries(store, date).reduce((sum, e) => sum + e.hours, 0)),
    hoursPerDay: config.hoursPerDay,
  };
}

/** What's logged on a day, clients and events alike. */
export function dayEntries(store: Store, date: string): WorklogEntry[] {
  return store.db.getAllWorklog().filter((e) => e.date === date);
}

/** How a ledger id reads to a person: a client's name or an event's label. */
export function targetLabel(store: Store, target: string): string {
  if (isEventWorklogClientId(target)) {
    return eventLabel(eventTypeFromClientId(target));
  }
  return store.db.getClients().find((c) => c.id === target)?.name ?? target;
}
