// A task's progress log: adding a note, correcting one, and removing one. The
// whole stack is in-memory, so these run the real service → markdown → indexer
// path — which is where an edit that renders fine but serializes wrong shows up.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { addTaskNote, deleteTaskNote, updateTaskNote } from '../src/services/taskOps';
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

### Notes
- 2026-07-02 10:00 — Reproduced on an iPhone SE.
- 2026-07-03 09:30 — Waiting on design.

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02
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

function notes(id = 't_acme01') {
  return (task(id).notes ?? []).map((n) => `${n.timestamp} — ${n.text}`);
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

describe('updateTaskNote', () => {
  it('rewrites one note and leaves its timestamp and its neighbours alone', async () => {
    await updateTaskNote(store, 't_acme01', 0, 'Reproduced on an iPhone SE and a Pixel 4a.');

    expect(notes()).toEqual([
      '2026-07-02 10:00 — Reproduced on an iPhone SE and a Pixel 4a.',
      '2026-07-03 09:30 — Waiting on design.',
    ]);
  });

  it('serializes the edit back into the client file, not just into the cache', async () => {
    await updateTaskNote(store, 't_acme01', 1, 'Design landed.');

    const text = fm.text.get('clients/acme.md') ?? '';
    expect(text).toContain('- 2026-07-03 09:30 — Design landed.');
    expect(text).not.toContain('Waiting on design');
    // The rest of the block is untouched — description, meta and the sibling task.
    expect(text).toContain('The picker misses taps on small screens.');
    expect(text).toContain('- id: t_acme02');
  });

  it('keeps a multi-line note readable by indenting its continuation lines', async () => {
    await updateTaskNote(store, 't_acme01', 0, 'Reproduced.\n\n- iPhone SE\n- Pixel 4a');

    const text = fm.text.get('clients/acme.md') ?? '';
    expect(text).toContain('- 2026-07-02 10:00 — Reproduced.\n\n  - iPhone SE\n  - Pixel 4a');
    // And it survives the round trip back through the parser.
    expect(task().notes?.[0].text).toBe('Reproduced.\n\n- iPhone SE\n- Pixel 4a');
  });

  it('trims the text it is given', async () => {
    await updateTaskNote(store, 't_acme01', 0, '  Trimmed.  \n');

    expect(task().notes?.[0].text).toBe('Trimmed.');
  });

  it('refuses an empty note rather than leaving a stamp with no body', async () => {
    await expect(updateTaskNote(store, 't_acme01', 0, '   ')).rejects.toThrow(/empty note/);
    expect(notes()).toHaveLength(2);
  });

  it('refuses an index that names no note', async () => {
    await expect(updateTaskNote(store, 't_acme01', 5, 'Nowhere.')).rejects.toThrow(/no note at index/);
    await expect(updateTaskNote(store, 't_acme02', 0, 'Nowhere.')).rejects.toThrow(/no note at index/);
    await expect(updateTaskNote(store, 't_missing', 0, 'Nowhere.')).rejects.toThrow(/not found/);
  });
});

describe('addTaskNote / deleteTaskNote', () => {
  it('appends to the end of the log and removes by index', async () => {
    await addTaskNote(store, 't_acme02', 'Kicked off.');
    expect(task('t_acme02').notes).toHaveLength(1);

    await deleteTaskNote(store, 't_acme01', 0);
    expect(notes()).toEqual(['2026-07-03 09:30 — Waiting on design.']);
  });
});
