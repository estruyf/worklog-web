// Status helpers. Statuses are user-configurable in .worklog/config.json; these
// supply the defaults and the "which id is terminal" logic that drives the
// close → archive behaviour.

import type { StatusDef } from './types';

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Closed', terminal: true },
];

/** The id of the terminal (closing) status — last resort 'done'. */
export function terminalStatusId(statuses: StatusDef[]): string {
  return (statuses.find((s) => s.terminal) ?? statuses[statuses.length - 1])?.id ?? 'done';
}

export function isTerminalStatus(statuses: StatusDef[], id: string): boolean {
  return statuses.find((s) => s.id === id)?.terminal === true;
}

/** The id of the default "open" status — where a newly started task sits. Used
 *  to reset a recurring task when it rolls onto its next occurrence. */
export function openStatusId(statuses: StatusDef[]): string {
  return (statuses.find((s) => !s.terminal) ?? statuses[0])?.id ?? 'open';
}

/** The id of the "in progress" (actively working) status. Prefers an explicit
 *  `in-progress` id, else the second non-terminal status; undefined if none. */
export function inProgressStatusId(statuses: StatusDef[]): string | undefined {
  const explicit = statuses.find((s) => s.id === 'in-progress');
  if (explicit) {
    return explicit.id;
  }
  return statuses.filter((s) => !s.terminal)[1]?.id;
}

export function statusLabel(statuses: StatusDef[], id: string): string {
  return statuses.find((s) => s.id === id)?.label ?? id;
}
