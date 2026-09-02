// Logging one entry across a run of days — the calendar's range selection. What
// matters here is the ledger it leaves behind: a range crossing a month boundary
// touches both files, an existing line for the same client is replaced rather
// than doubled, and every other entry on those days survives.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { setWorklogRange } from '../src/services/worklog';
import { eventWorklogClientId } from '../src/model/worklog';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [{ id: 'acme', name: 'Acme Corp' }],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
  autoSync: { enabled: false, delayMinutes: 5 },
};

const VACATION = eventWorklogClientId('vacation');

let store: Store;
let fm: FileMap;

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', '# Acme Corp\n');
  fm.text.set('worklog/2026-07.md', '# Worklog 2026-07\n\n- 2026-07-30 acme 8\n- 2026-07-31 acme 4\n');
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

const file = (month: string) => fm.text.get(`worklog/${month}.md`);

describe('setWorklogRange', () => {
  it('writes one line per day, across every month the range spans', async () => {
    await setWorklogRange(store, ['2026-07-30', '2026-07-31', '2026-08-03'], VACATION, 8);

    expect(file('2026-07')).toBe(
      '# Worklog 2026-07\n\n- 2026-07-30 acme 8\n- 2026-07-31 acme 4\n' +
        `- 2026-07-30 ${VACATION} 8\n- 2026-07-31 ${VACATION} 8\n`,
    );
    // The August file did not exist yet, so it arrives with its own heading.
    expect(file('2026-08')).toBe(`# Worklog 2026-08\n\n- 2026-08-03 ${VACATION} 8\n`);
  });

  it('leaves the day’s other entries alone — a range adds, it does not clear the day', async () => {
    await setWorklogRange(store, ['2026-07-30'], VACATION, 8, 'Away');

    expect(file('2026-07')).toContain('- 2026-07-30 acme 8\n');
    expect(file('2026-07')).toContain(`- 2026-07-30 ${VACATION} 8 — Away\n`);
  });

  it('replaces the line already there for the same client', async () => {
    await setWorklogRange(store, ['2026-07-30', '2026-07-31'], 'acme', 4);

    expect(file('2026-07')).toBe('# Worklog 2026-07\n\n- 2026-07-30 acme 4\n- 2026-07-31 acme 4\n');
  });

  it('lands in the store, so the calendar reads the days back', async () => {
    await setWorklogRange(store, ['2026-07-30', '2026-07-31'], VACATION, 8);

    const days = store.db.worklog.filter((w) => w.clientId === VACATION).map((w) => w.date);
    expect(days).toEqual(['2026-07-30', '2026-07-31']);
  });

  it('does nothing for an empty range or a zero amount', async () => {
    const before = file('2026-07');
    await setWorklogRange(store, [], VACATION, 8);
    await setWorklogRange(store, ['2026-07-30'], VACATION, 0);
    expect(file('2026-07')).toBe(before);
  });
});
