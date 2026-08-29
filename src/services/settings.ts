// App configuration service. Persists the scalar app-level settings that live in
// .worklog/config.json but aren't managed elsewhere (clients: Clients view,
// statuses: defaults). Writes config.json and rebuilds so views pick up the change.

import { Store } from '../store';
import { parseAiAgents, type AiAgent } from '../model/aiAgents';
import { parseAutoSyncEvents, type AutoSyncEvent } from '../model/syncEvents';
import { normalizeCodeTheme, type CodeTheme } from '../model/codeTheme';
import { normalizeTaskSort, type TaskSortPref } from '../model/taskSort';
import { parseWeekStart } from '../workspace/paths';

export interface SettingsFields {
  /** Hours in a full working day; drives the "full/½ day" labels and insights. */
  hoursPerDay?: number;
  /** First weekday of the calendar grid: 0 = Sunday … 6 = Saturday. */
  weekStart?: number;
  /** How many open to-dos the day view's side list shows per page. */
  todosPerPage?: number;
  /** The order open-task lists start in. */
  defaultTaskSort?: TaskSortPref;
  /** Which Demo Time theme paints fenced code blocks. */
  codeTheme?: CodeTheme;
  /** Automatic Git sync after logging time. Only the provided keys are changed;
   *  `events` is the change kinds that sync right away instead of on the delay. */
  autoSync?: { enabled?: boolean; delayMinutes?: number; events?: AutoSyncEvent[] };
  /** Which optional task blocks are offered. Only the provided keys are changed. */
  features?: { attachments?: boolean; prompts?: boolean; lists?: boolean };
  /** The AI agents a task can be handed to, by id. The whole list, not a delta. */
  aiAgents?: AiAgent[];
}

/** Update app-wide settings in config.json, then rebuild. */
export async function updateSettings(store: Store, fields: SettingsFields): Promise<void> {
  const config = await store.ws.loadConfig();

  if (fields.hoursPerDay !== undefined) {
    if (!(fields.hoursPerDay > 0)) {
      throw new Error('Hours per day must be greater than 0.');
    }
    config.hoursPerDay = fields.hoursPerDay;
  }

  if (fields.weekStart !== undefined) {
    if (!Number.isInteger(fields.weekStart) || fields.weekStart < 0 || fields.weekStart > 6) {
      throw new Error('Week start must be a day of the week.');
    }
    config.weekStart = parseWeekStart(fields.weekStart);
  }

  if (fields.todosPerPage !== undefined) {
    if (!Number.isInteger(fields.todosPerPage) || fields.todosPerPage < 1) {
      throw new Error('To-dos per page must be a whole number of at least 1.');
    }
    config.todosPerPage = fields.todosPerPage;
  }

  // Normalized rather than validated, for the same reason as `autoSync.events`:
  // a sort key this version doesn't know means a config written by a newer one.
  if (fields.defaultTaskSort !== undefined) {
    config.defaultTaskSort = normalizeTaskSort(fields.defaultTaskSort);
  }

  // Normalized rather than validated, for the same reason as `defaultTaskSort`.
  if (fields.codeTheme !== undefined) {
    config.codeTheme = normalizeCodeTheme(fields.codeTheme);
  }

  if (fields.autoSync !== undefined) {
    const enabled = fields.autoSync.enabled ?? config.autoSync.enabled;
    const delayMinutes = fields.autoSync.delayMinutes ?? config.autoSync.delayMinutes;
    if (!Number.isFinite(delayMinutes) || delayMinutes < 1) {
      throw new Error('Auto-sync delay must be at least 1 minute.');
    }
    // Normalized rather than validated: an id this version doesn't know is a
    // config written by a newer one, and dropping it silently beats refusing to
    // save the rest of the settings.
    const events = fields.autoSync.events === undefined ? config.autoSync.events : parseAutoSyncEvents(fields.autoSync.events);
    config.autoSync = { enabled, delayMinutes, events };
  }

  // A display switch, so there is nothing to validate: off hides the block, and
  // what is already written in the Markdown is left where it is.
  if (fields.features !== undefined) {
    config.features = {
      attachments: fields.features.attachments ?? config.features.attachments,
      prompts: fields.features.prompts ?? config.features.prompts,
      lists: fields.features.lists ?? config.features.lists,
    };
  }

  // Normalized for the same reason as `autoSync.events`, and to the same effect:
  // an agent id this version doesn't offer belongs to a newer one, and dropping
  // it silently beats refusing to save the rest.
  if (fields.aiAgents !== undefined) {
    config.aiAgents = parseAiAgents(fields.aiAgents);
  }

  await store.ws.saveConfig(config);
  await store.rebuild('updateSettings');
}
