// Status helpers. Statuses are user-configurable in .worklog/config.json; these
// supply the defaults, the normalization every reader relies on, and the "which
// id is terminal" logic that drives the close → archive behaviour.

import type { StatusDef } from './types';

export const DEFAULT_STATUSES: StatusDef[] = [
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'done', label: 'Closed', terminal: true },
];

/** Long enough for "Waiting for review", short enough that the status column on a
 *  task row stays a column rather than becoming the row. */
export const MAX_STATUS_LABEL = 20;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A status id derived from its display name, in the same shape client ids use:
 *  the id is what the Markdown carries, so it has to survive a rename of the
 *  label and be safe to hand-type. */
export function slugifyStatusId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/** A `#rgb`/`#rrggbb` accent, or undefined for anything else — the value is read
 *  back out of a file the user can hand-edit and rendered as a colour. */
export function parseStatusColor(color: unknown): string | undefined {
  const value = typeof color === 'string' ? color.trim() : '';
  return HEX_COLOR.test(value) ? value : undefined;
}

/** The configured statuses reduced to the shape the rest of the app assumes:
 *  valid entries only, unique ids, and exactly one terminal status — always last.
 *
 *  That invariant is load-bearing. `terminalStatusId` decides what archives a
 *  task and `openStatusId` decides where a new one starts, and a hand-edited
 *  config with two terminal entries, or none, would make both of those a guess.
 *  A config that flags nothing keeps the reading this app has always had: the
 *  last entry is the closing one. */
export function normalizeStatuses(input: unknown): StatusDef[] {
  const defs: StatusDef[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input) ? input : []) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const candidate = raw as Partial<StatusDef>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
    if (!id || !label || seen.has(id)) {
      continue;
    }
    seen.add(id);
    // `terminal` and `color` are normalized to value-or-absent so JSON.stringify
    // drops them rather than round-tripping `false`/`null` into config.json.
    defs.push({
      id,
      label: label.slice(0, MAX_STATUS_LABEL),
      terminal: candidate.terminal === true || undefined,
      color: parseStatusColor(candidate.color),
    });
  }
  if (defs.length === 0) {
    return DEFAULT_STATUSES.map((s) => ({ ...s }));
  }

  const flagged = defs.findIndex((s) => s.terminal);
  const terminalIndex = flagged >= 0 ? flagged : defs.length - 1;
  const terminal = defs[terminalIndex];
  const working = defs.filter((_, i) => i !== terminalIndex);
  // Nothing but the closing status leaves a new task nowhere to start, so the
  // first default that doesn't collide with it goes back in front.
  if (working.length === 0) {
    const fallback = DEFAULT_STATUSES.find((s) => !s.terminal && s.id !== terminal.id) ?? { id: 'open', label: 'Open' };
    working.push({ id: fallback.id, label: fallback.label });
  }

  return [
    ...working.map((s) => ({ ...s, terminal: undefined })),
    { ...terminal, terminal: true as const },
  ];
}

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

/** Status ids tasks still carry that the config no longer lists, most-used
 *  first. Removing a status leaves the tasks in it untouched on purpose — the id
 *  lives in the user's Markdown — so this is how those tasks stay findable
 *  instead of quietly rendering a raw id forever. */
export function orphanStatusIds(
  statuses: StatusDef[],
  tasks: { status: string }[],
): { id: string; count: number }[] {
  const configured = new Set(statuses.map((s) => s.id));
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (task.status && !configured.has(task.status)) {
      counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}
