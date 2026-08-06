// Task-status configuration service. Owns the `statuses` array in
// .worklog/config.json — adding a working status, renaming/recolouring one,
// reordering them and removing one again — then rebuilds so views pick it up.
//
// Removing a status is deliberately non-destructive: tasks keep the id they
// carry, because the id lives in the user's Markdown and rewriting every block
// to a status they didn't choose would be a silent bulk edit. Those tasks keep
// rendering their raw id until they're moved on, which is what the UI warns
// about — `orphanStatusIds` in model/status is how it finds them again.

import { Store } from '../store';
import type { StatusDef } from '../model/types';
import {
  MAX_STATUS_LABEL,
  normalizeStatuses,
  parseStatusColor,
  slugifyStatusId,
} from '../model/status';

export interface NewStatusInput {
  label: string;
  /** Optional explicit id; otherwise derived from the label. Used to put back a
   *  status that tasks still carry but the config no longer lists. */
  id?: string;
  /** Optional accent colour (`#rgb`/`#rrggbb`). */
  color?: string;
}

export interface StatusFields {
  label?: string;
  /** Pass '' to fall back to the built-in colour for this id. */
  color?: string;
}

function validLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error('A status name is required.');
  }
  if (trimmed.length > MAX_STATUS_LABEL) {
    throw new Error(`A status name can be at most ${MAX_STATUS_LABEL} characters.`);
  }
  return trimmed;
}

/** Add a working status. It lands directly before the closing one, which stays
 *  last — see `normalizeStatuses` for why that position is an invariant. */
export async function createStatus(store: Store, input: NewStatusInput): Promise<StatusDef> {
  const label = validLabel(input.label);
  const id = input.id?.trim() || slugifyStatusId(label);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error('Status id must be lowercase letters, numbers and dashes.');
  }

  const config = await store.ws.loadConfig();
  if (config.statuses.some((s) => s.id === id)) {
    throw new Error(`A status with id "${id}" already exists.`);
  }

  const def: StatusDef = { id, label, color: parseStatusColor(input.color) };
  config.statuses.splice(config.statuses.length - 1, 0, def);
  config.statuses = normalizeStatuses(config.statuses);
  await store.ws.saveConfig(config);
  await store.rebuild('addStatus');
  return def;
}

/** Rename or recolour a status. The id is left alone — it is what every task
 *  block in the repo refers to, so changing it would orphan all of them. */
export async function updateStatus(store: Store, id: string, fields: StatusFields): Promise<StatusDef> {
  const config = await store.ws.loadConfig();
  const status = config.statuses.find((s) => s.id === id);
  if (!status) {
    throw new Error(`Unknown status "${id}".`);
  }
  if (fields.label !== undefined) {
    status.label = validLabel(fields.label);
  }
  if (fields.color !== undefined) {
    status.color = parseStatusColor(fields.color);
  }
  config.statuses = normalizeStatuses(config.statuses);
  await store.ws.saveConfig(config);
  await store.rebuild('updateStatus');
  return { ...status };
}

/** Move a working status one place up or down the list. The order is what the
 *  status filter sorts by and the order the quick picker offers; the closing
 *  status is pinned last and never takes part. */
export async function moveStatus(store: Store, id: string, delta: -1 | 1): Promise<void> {
  const config = await store.ws.loadConfig();
  const index = config.statuses.findIndex((s) => s.id === id);
  if (index < 0) {
    throw new Error(`Unknown status "${id}".`);
  }
  if (config.statuses[index].terminal) {
    throw new Error('The closing status always comes last.');
  }
  const target = index + delta;
  // The last working status is at length - 2; the closing one holds length - 1.
  if (target < 0 || target > config.statuses.length - 2) {
    return;
  }
  const [moved] = config.statuses.splice(index, 1);
  config.statuses.splice(target, 0, moved);
  config.statuses = normalizeStatuses(config.statuses);
  await store.ws.saveConfig(config);
  await store.rebuild('moveStatus');
}

/** Drop a working status from the config. Tasks sitting in it are left exactly
 *  as they are — see the header note. */
export async function deleteStatus(store: Store, id: string): Promise<void> {
  const config = await store.ws.loadConfig();
  const index = config.statuses.findIndex((s) => s.id === id);
  if (index < 0) {
    throw new Error(`Unknown status "${id}".`);
  }
  if (config.statuses[index].terminal) {
    throw new Error('The closing status can\'t be removed — it is what archives a task.');
  }
  if (config.statuses.filter((s) => !s.terminal).length < 2) {
    throw new Error('At least one working status is needed, or a new task has nowhere to start.');
  }

  config.statuses.splice(index, 1);
  config.statuses = normalizeStatuses(config.statuses);
  await store.ws.saveConfig(config);
  await store.rebuild('deleteStatus');
}
