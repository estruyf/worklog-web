// App configuration service. Persists the scalar app-level settings that live in
// .worklog/config.json but aren't managed elsewhere (clients: Clients view,
// statuses: defaults). Writes config.json and rebuilds so views pick up the change.

import { Store } from '../store';
import { parseWeekStart } from '../workspace/paths';

export interface SettingsFields {
  /** Hours in a full working day; drives the "full/½ day" labels and insights. */
  hoursPerDay?: number;
  /** First weekday of the calendar grid: 0 = Sunday … 6 = Saturday. */
  weekStart?: number;
  /** Automatic Git sync after logging time. Only the provided keys are changed. */
  autoSync?: { enabled?: boolean; delayMinutes?: number };
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

  if (fields.autoSync !== undefined) {
    const enabled = fields.autoSync.enabled ?? config.autoSync.enabled;
    const delayMinutes = fields.autoSync.delayMinutes ?? config.autoSync.delayMinutes;
    if (!Number.isFinite(delayMinutes) || delayMinutes < 1) {
      throw new Error('Auto-sync delay must be at least 1 minute.');
    }
    config.autoSync = { enabled, delayMinutes };
  }

  await store.ws.saveConfig(config);
  await store.rebuild('updateSettings');
}
