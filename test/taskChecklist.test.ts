// A task's own checklist: the steps it breaks down into, written into a
// `### Checklist` section on the task block. Like the prompt tests, the whole
// stack is in-memory, so these run the real service → markdown → indexer path —
// which is where a step that renders fine but serializes wrong shows up.
//
// The parser half matters most: the section has to stay out of the description
// and out of the two other reserved sections, and come back in the same place it
// went in. A step that parses and never serializes is silently dropped on the
// next commit.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import {
  addTaskChecklist,
  closeTaskById,
  deleteTaskChecklistItem,
  setTaskChecklistItemDone,
  updateTaskChecklistItem,
} from '../src/services/taskOps';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';
import { autoSyncEventFor } from '../src/model/syncEvents';
import type { Task } from '../src/model/types';

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

const ACME_MD = `# Acme Corp

## Fix the mobile picker
- id: t_acme01
- status: open
- created: 2026-07-01

The picker misses taps on small screens.

### Checklist
- [x] Measure every control
- [ ] Widen the ones under 44px

### Prompts
- [ ] Draft the tap-target audit
  List every control under 44px.

### Notes
- 2026-07-02 10:00 — Reproduced on an iPhone SE.

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02

## Water the office plants
- id: t_water
- status: open
- created: 2026-06-01
- due: 2026-07-30
- repeat: weekly on mon,thu

### Checklist
- [x] Fern
- [ ] Spider plant
`;

let store: Store;
let fm: FileMap;

function task(id = 't_acme01'): Task {
  const t = store.db.getTask(id);
  if (!t) {
    throw new Error(`Task ${id} vanished.`);
  }
  return t;
}

function steps(id = 't_acme01') {
  return task(id).checklist ?? [];
}

function acme(): string {
  return fm.text.get('clients/acme.md') ?? '';
}

/** Parse a task straight out of the on-disk file, bypassing the db. */
function fromFile(id: string): Task | undefined {
  return parseTaskFile(acme(), 'clients/acme.md', 'acme').tasks.find((t) => t.id === id);
}

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

describe('parsing a ### Checklist section', () => {
  it('reads the ticked and unticked items in file order', () => {
    expect(steps()).toEqual([
      { text: 'Measure every control', done: true },
      { text: 'Widen the ones under 44px', done: false },
    ]);
  });

  it('keeps the description, the prompts and the notes to themselves', () => {
    expect(task().description).toBe('The picker misses taps on small screens.');
    expect(task().prompts).toHaveLength(1);
    expect(task().notes).toEqual([{ timestamp: '2026-07-02 10:00', text: 'Reproduced on an iPhone SE.' }]);
  });

  it('ignores anything in the section that is not a checkbox line', () => {
    const parsed = parseTaskFile(
      '## Hand written\n- id: t_hand01\n- status: open\n\n### Checklist\n\nStill deciding these.\n- [ ] One\n- [ ]   \n',
      'clients/acme.md',
      'acme',
    ).tasks[0];

    expect(parsed.checklist).toEqual([{ text: 'One', done: false }]);
  });

  it('serializes back above the prompts, and round-trips the whole block', () => {
    const block = serializeTask(task(), 'acme');
    expect(block).toContain('### Checklist\n- [x] Measure every control\n- [ ] Widen the ones under 44px');
    expect(block.indexOf('### Checklist')).toBeLessThan(block.indexOf('### Prompts'));
    expect(parseTaskFile(block, 'clients/acme.md', 'acme').tasks[0].checklist).toEqual(steps());
  });

  it('writes no section for a task that has no steps', () => {
    expect(serializeTask(task('t_acme02'), 'acme')).not.toContain('### Checklist');
  });
});

describe('editing a checklist', () => {
  it('adds a step to the end, unticked', async () => {
    await addTaskChecklist(store, 't_acme01', ['Re-test on an SE']);

    expect(steps()).toEqual([
      { text: 'Measure every control', done: true },
      { text: 'Widen the ones under 44px', done: false },
      { text: 'Re-test on an SE', done: false },
    ]);
    expect(acme()).toContain('- [ ] Re-test on an SE');
  });

  it('starts a checklist on a task that has none', async () => {
    await addTaskChecklist(store, 't_acme02', ['Agree the columns', 'Send the file']);

    expect(steps('t_acme02')).toEqual([
      { text: 'Agree the columns', done: false },
      { text: 'Send the file', done: false },
    ]);
    // Between the metadata and nothing else — the task has no description.
    expect(acme()).toContain('### Checklist\n- [ ] Agree the columns\n- [ ] Send the file');
  });

  it('copies a whole list on in one write, skipping the blanks', async () => {
    await addTaskChecklist(store, 't_acme02', ['Repo access', '   ', 'Billing contact']);

    expect(steps('t_acme02').map((s) => s.text)).toEqual(['Repo access', 'Billing contact']);
  });

  it('folds a pasted multi-line step onto one line', async () => {
    await addTaskChecklist(store, 't_acme02', ['Ask the client\nabout the columns']);

    expect(steps('t_acme02')).toEqual([{ text: 'Ask the client about the columns', done: false }]);
    // Or it would come back as two steps, the second one unrecognisable.
    expect(fromFile('t_acme02')?.checklist).toHaveLength(1);
  });

  it('ticks a step off and puts it back, leaving the rest alone', async () => {
    await setTaskChecklistItemDone(store, 't_acme01', 1, true);
    expect(steps()[1]).toEqual({ text: 'Widen the ones under 44px', done: true });

    await setTaskChecklistItemDone(store, 't_acme01', 0, false);
    expect(steps()).toEqual([
      { text: 'Measure every control', done: false },
      { text: 'Widen the ones under 44px', done: true },
    ]);
  });

  it('never closes the task, however many steps are ticked', async () => {
    await setTaskChecklistItemDone(store, 't_acme01', 1, true);

    expect(task().status).toBe('open');
    expect(task().completed).toBeUndefined();
  });

  it('rewrites a step, keeping its tick', async () => {
    await updateTaskChecklistItem(store, 't_acme01', 0, 'Measure every tap target');

    expect(steps()[0]).toEqual({ text: 'Measure every tap target', done: true });
  });

  it('refuses a step with no words, and an index past the end', async () => {
    await expect(updateTaskChecklistItem(store, 't_acme01', 0, '  ')).rejects.toThrow(/needs some text/);
    await expect(setTaskChecklistItemDone(store, 't_acme01', 5, true)).rejects.toThrow(/no checklist item/);
  });

  it('removes a step by index', async () => {
    await deleteTaskChecklistItem(store, 't_acme01', 0);

    expect(steps()).toEqual([{ text: 'Widen the ones under 44px', done: false }]);
    expect(acme()).not.toContain('Measure every control');
  });

  it('drops the section once the last step goes', async () => {
    await deleteTaskChecklistItem(store, 't_acme01', 0);
    await deleteTaskChecklistItem(store, 't_acme01', 0);

    expect(steps()).toEqual([]);
    expect(acme()).not.toContain('### Checklist\n\n');
    expect(fromFile('t_acme01')?.checklist).toBeUndefined();
  });

  it('counts every edit as a task edit for auto-sync', () => {
    for (const reason of ['addTaskChecklist', 'setTaskChecklistItem', 'updateTaskChecklistItem', 'deleteTaskChecklistItem']) {
      expect(autoSyncEventFor(reason)).toBe('taskEdited');
    }
  });
});

describe('a recurring task’s checklist', () => {
  it('carries the steps onto the next occurrence, unticked', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');

    expect(fromFile('t_water')?.checklist).toEqual([
      { text: 'Fern', done: false },
      { text: 'Spider plant', done: false },
    ]);
  });

  it('leaves the ticks on the archived occurrence', async () => {
    await closeTaskById(store, 't_water', '2026-07-30');

    const archive = fm.text.get('archive/acme/2026-07.md') ?? '';
    const snapshot = parseTaskFile(archive, 'archive/acme/2026-07.md', 'acme').tasks.find((t) => t.repeatOf === 't_water');
    expect(snapshot?.checklist).toEqual([
      { text: 'Fern', done: true },
      { text: 'Spider plant', done: false },
    ]);
  });
});
