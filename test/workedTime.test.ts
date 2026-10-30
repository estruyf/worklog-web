// Time spent on a task per day: written after the date on its `- worked:` line,
// so a line from before time existed parses unchanged and a day's time can't
// outlive the day.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';
import { setTaskWorkedTime, toggleTaskWorkedOn } from '../src/services/taskOps';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [{ id: 'acme', name: 'Acme Corp' }],
  statuses: [
    { id: 'open', label: 'Open' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'done', label: 'Closed', terminal: true },
  ],
};

const ACME_MD = `# Acme Corp

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02
- worked: 2026-07-03 2h
`;

describe('worked time in the Markdown', () => {
  it('reads a duration as belonging to the date in front of it', () => {
    const md = `## T\n- id: t_1\n- worked: 2026-07-03 2026-07-04 1h30m\n- worked: 2026-07-06 45m\n`;
    const [task] = parseTaskFile(md, 'clients/acme.md', 'acme').tasks;
    expect(task.workedOn).toEqual(['2026-07-03', '2026-07-04', '2026-07-06']);
    expect(task.workedTime).toEqual({ '2026-07-04': 90, '2026-07-06': 45 });
  });

  it('leaves a line without time exactly as it was', () => {
    const [task] = parseTaskFile(`## T\n- id: t_1\n- worked: 2026-07-03\n`, 'x', 'acme').tasks;
    expect(task.workedTime).toBeUndefined();
    expect(serializeTask(task, 'acme').split('\n')).toContain('- worked: 2026-07-03');
  });

  it('writes the time back on the day it belongs to', () => {
    const [task] = parseTaskFile(`## T\n- id: t_1\n- worked: 2026-07-03 90m\n- worked: 2026-07-04\n`, 'x', 'acme').tasks;
    const out = serializeTask(task, 'acme');
    expect(out).toContain('- worked: 2026-07-03 1h30m\n- worked: 2026-07-04');
  });
});

let store: Store;
let fm: FileMap;

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', ACME_MD);
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

describe('setTaskWorkedTime', () => {
  it('marks a day not yet worked, and moves the task into progress', async () => {
    await setTaskWorkedTime(store, 't_acme02', '2026-07-10', 75);
    const task = store.db.getTask('t_acme02')!;
    expect(task.workedOn).toEqual(['2026-07-03', '2026-07-10']);
    expect(task.workedTime).toEqual({ '2026-07-03': 120, '2026-07-10': 75 });
    expect(task.status).toBe('in-progress');
    expect(fm.text.get('clients/acme.md')).toContain('- worked: 2026-07-10 1h15m');
  });

  it('clearing the time keeps the day worked', async () => {
    await setTaskWorkedTime(store, 't_acme02', '2026-07-03', undefined);
    const task = store.db.getTask('t_acme02')!;
    expect(task.workedOn).toEqual(['2026-07-03']);
    expect(task.workedTime).toBeUndefined();
  });

  it('taking the day off takes its time with it', async () => {
    await toggleTaskWorkedOn(store, 't_acme02', '2026-07-03');
    await toggleTaskWorkedOn(store, 't_acme02', '2026-07-03');
    const task = store.db.getTask('t_acme02')!;
    expect(task.workedOn).toEqual(['2026-07-03']);
    expect(task.workedTime).toBeUndefined();
  });
});
