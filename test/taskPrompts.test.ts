// A task's prompt queue: writing one, ticking it off, correcting it and removing
// it. Like the notes tests, the whole stack is in-memory, so these run the real
// service → markdown → indexer path — which is where a prompt that renders fine
// but serializes wrong shows up.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import {
  addTaskPrompt,
  deleteTaskPrompt,
  setTaskPromptRan,
  updateTaskPrompt,
} from '../src/services/taskOps';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';
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

### Prompts
- [ ] Draft the tap-target audit
  List every control under 44px in src/ui/**.

  Group them by view.
- [x] 2026-07-03 09:30 — Summarise the crash reports
  One paragraph, no jargon.

### Notes
- 2026-07-02 10:00 — Reproduced on an iPhone SE.

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

function prompts(id = 't_acme01') {
  return task(id).prompts ?? [];
}

function acme(): string {
  return fm.text.get('clients/acme.md') ?? '';
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

describe('parsing a ### Prompts section', () => {
  it('reads the queued and the ran entries, with their bodies', () => {
    expect(prompts()).toEqual([
      {
        title: 'Draft the tap-target audit',
        text: 'List every control under 44px in src/ui/**.\n\nGroup them by view.',
        ran: undefined,
        ranAt: undefined,
      },
      {
        title: 'Summarise the crash reports',
        text: 'One paragraph, no jargon.',
        ran: true,
        ranAt: '2026-07-03 09:30',
      },
    ]);
  });

  it('keeps the description and the notes to themselves', () => {
    expect(task().description).toBe('The picker misses taps on small screens.');
    expect(task().notes).toEqual([
      { timestamp: '2026-07-02 10:00', text: 'Reproduced on an iPhone SE.' },
    ]);
  });

  it('reads a hand-written `- [x]` with no stamp as run, without inventing one', () => {
    const parsed = parseTaskFile(
      '## Hand written\n- id: t_hand01\n- status: open\n\n### Prompts\n- [x] Ran this one already\n',
      'clients/acme.md',
      'acme',
    ).tasks[0];

    expect(parsed.prompts).toEqual([{ title: 'Ran this one already', text: '', ran: true, ranAt: undefined }]);
    // And it stays that way: no stamp is written where the file had none.
    expect(serializeTask(parsed, 'acme')).toContain('- [x] Ran this one already');
  });

  it('round-trips a body that is itself a checkbox list, rather than reading it as more prompts', () => {
    const t = task();
    const withList: Task = {
      ...t,
      prompts: [{ title: 'Check the list', text: '- [ ] one\n- [x] two\n- three' }],
    };
    const reparsed = parseTaskFile(serializeTask(withList, 'acme'), 'clients/acme.md', 'acme').tasks[0];

    expect(reparsed.prompts).toEqual([
      { title: 'Check the list', text: '- [ ] one\n- [x] two\n- three', ran: undefined, ranAt: undefined },
    ]);
  });
});

describe('addTaskPrompt', () => {
  it('appends to the queue and writes a checkbox entry with the body indented under it', async () => {
    await addTaskPrompt(store, 't_acme01', 'Write the release note', 'Two sentences.\nPlain English.');

    expect(prompts().map((p) => p.title)).toEqual([
      'Draft the tap-target audit',
      'Summarise the crash reports',
      'Write the release note',
    ]);
    expect(acme()).toContain('- [ ] Write the release note\n  Two sentences.\n  Plain English.');
    // Untouched neighbours: the description, the notes and the sibling task.
    expect(acme()).toContain('The picker misses taps on small screens.');
    expect(acme()).toContain('- 2026-07-02 10:00 — Reproduced on an iPhone SE.');
    expect(acme()).toContain('- id: t_acme02');
  });

  it('starts the section on a task that has none, above the notes', async () => {
    await addTaskPrompt(store, 't_acme02', 'Kick it off', 'Draft the invoice email.');

    expect(prompts('t_acme02')).toHaveLength(1);
    expect(acme()).toContain('### Prompts\n- [ ] Kick it off\n  Draft the invoice email.');
  });

  it('takes a prompt that is only a title, for an idea without the wording yet', async () => {
    await addTaskPrompt(store, 't_acme02', 'Something about the PDF layout', '');

    expect(prompts('t_acme02')[0]).toMatchObject({ title: 'Something about the PDF layout', text: '' });
    expect(acme()).toContain('- [ ] Something about the PDF layout');
  });

  it('folds a pasted multi-line title onto one line — the entry line is the title', async () => {
    await addTaskPrompt(store, 't_acme02', '  Audit\nthe   headers  ', 'Body.');

    expect(prompts('t_acme02')[0].title).toBe('Audit the headers');
  });

  it('refuses a prompt with no title', async () => {
    await expect(addTaskPrompt(store, 't_acme01', '   ', 'Body.')).rejects.toThrow(/needs a title/);
    expect(prompts()).toHaveLength(2);
  });
});

describe('setTaskPromptRan', () => {
  it('ticks a prompt off with a stamp, and leaves it where it is in the file', async () => {
    await setTaskPromptRan(store, 't_acme01', 0, true);

    const [first] = prompts();
    expect(first.ran).toBe(true);
    expect(first.ranAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(acme()).toContain(`- [x] ${first.ranAt} — Draft the tap-target audit`);
    // Still the first entry: ticking is not a reordering.
    expect(prompts().map((p) => p.title)[0]).toBe('Draft the tap-target audit');
  });

  it('puts one back in the queue, dropping the stamp with it', async () => {
    await setTaskPromptRan(store, 't_acme01', 1, false);

    expect(prompts()[1]).toMatchObject({ title: 'Summarise the crash reports', ran: undefined, ranAt: undefined });
    expect(acme()).toContain('- [ ] Summarise the crash reports');
    expect(acme()).not.toContain('2026-07-03 09:30 — Summarise');
  });

  it('refuses an index that names no prompt', async () => {
    await expect(setTaskPromptRan(store, 't_acme01', 5, true)).rejects.toThrow(/no prompt at index/);
    await expect(setTaskPromptRan(store, 't_missing', 0, true)).rejects.toThrow(/not found/);
  });
});

describe('updateTaskPrompt / deleteTaskPrompt', () => {
  it('rewrites a prompt without claiming it has been run', async () => {
    await updateTaskPrompt(store, 't_acme01', 1, 'Summarise the crash reports', 'One paragraph. Name the top three devices.');

    expect(prompts()[1]).toEqual({
      title: 'Summarise the crash reports',
      text: 'One paragraph. Name the top three devices.',
      ran: true,
      ranAt: '2026-07-03 09:30',
    });
    expect(acme()).toContain('- [x] 2026-07-03 09:30 — Summarise the crash reports\n  One paragraph. Name the top three devices.');
  });

  it('removes one by index and leaves the other alone', async () => {
    await deleteTaskPrompt(store, 't_acme01', 0);

    expect(prompts().map((p) => p.title)).toEqual(['Summarise the crash reports']);
    expect(acme()).not.toContain('tap-target audit');
    expect(acme()).toContain('### Prompts');
  });

  it('drops the section entirely once the last prompt is gone', async () => {
    await deleteTaskPrompt(store, 't_acme01', 0);
    await deleteTaskPrompt(store, 't_acme01', 0);

    expect(task().prompts).toBeUndefined();
    expect(acme()).not.toContain('### Prompts');
    // The notes and the description are still there — only the queue went.
    expect(acme()).toContain('### Notes');
    expect(acme()).toContain('The picker misses taps on small screens.');
  });

  it('refuses to edit an index that names no prompt', async () => {
    await expect(updateTaskPrompt(store, 't_acme02', 0, 'Nowhere', 'Body.')).rejects.toThrow(/no prompt at index/);
  });
});
