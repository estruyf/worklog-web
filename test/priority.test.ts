// The fixed priority scale: how a `- priority:` line parses, ranks, buckets and
// serializes, and what the app is willing to write back into Markdown.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { createTask } from '../src/services/tasks';
import { updateTask } from '../src/services/taskOps';
import {
  NORMAL_PRIORITY_ID,
  PRIORITIES,
  isMarkedPriority,
  priorityBucket,
  priorityDef,
  priorityRank,
  writablePriority,
} from '../src/model/priority';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';
import type { Task } from '../src/model/types';

const parse = (md: string) => parseTaskFile(md, 'clients/acme.md', 'acme').tasks;

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.id,
    status: 'open',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'clients/acme.md',
    sourceLine: 0,
    ...over,
  };
}

describe('the scale', () => {
  it('is ordered most important first, with normal in the middle', () => {
    expect(PRIORITIES.map((p) => p.id)).toEqual(['urgent', 'high', NORMAL_PRIORITY_ID, 'low']);
    expect(PRIORITIES.map((p) => p.rank)).toEqual([0, 1, 2, 3]);
  });

  it('ranks an unset priority as normal, not as last', () => {
    expect(priorityRank(undefined)).toBe(priorityRank(NORMAL_PRIORITY_ID));
    expect(priorityRank('high')).toBeLessThan(priorityRank(undefined));
    expect(priorityRank('low')).toBeGreaterThan(priorityRank(undefined));
  });

  it('reads a hand-typed value whatever its case or spacing', () => {
    expect(priorityDef('  High ')?.id).toBe('high');
    expect(priorityBucket('URGENT')).toBe('urgent');
  });

  it('ranks and buckets a value off the scale as normal', () => {
    expect(priorityRank('critical')).toBe(priorityRank(undefined));
    expect(priorityBucket('critical')).toBe(NORMAL_PRIORITY_ID);
    expect(priorityDef('critical')).toBeUndefined();
    expect(isMarkedPriority('critical')).toBe(false);
  });
});

describe('what the app writes back', () => {
  it('canonicalizes the three that mean something', () => {
    expect(writablePriority('Urgent')).toBe('urgent');
    expect(writablePriority('high')).toBe('high');
    expect(writablePriority('low')).toBe('low');
  });

  it('writes nothing for normal, blank or unrecognised', () => {
    expect(writablePriority(NORMAL_PRIORITY_ID)).toBeUndefined();
    expect(writablePriority('')).toBeUndefined();
    expect(writablePriority(undefined)).toBeUndefined();
    expect(writablePriority('critical')).toBeUndefined();
  });
});

describe('the markdown field', () => {
  it('parses a priority line, and reads its absence as no priority at all', () => {
    const [withIt, without] = parse(
      ['## A', '- id: t_a', '- status: open', '- priority: high', '', '## B', '- id: t_b', '- status: open', ''].join('\n'),
    );
    expect(withIt.priority).toBe('high');
    expect(without.priority).toBeUndefined();
  });

  it('keeps a value the scale does not name, rather than dropping the line', () => {
    const md = ['## A', '- id: t_a', '- status: open', '- priority: Critical', ''].join('\n');
    const [t] = parse(md);
    expect(t.priority).toBe('Critical');
    expect(serializeTask(t, 'acme')).toContain('- priority: Critical');
  });

  it('writes the line directly under the status', () => {
    const md = serializeTask(task({ id: 't_a', title: 'A', priority: 'urgent', due: '2026-08-10' }), 'acme');
    expect(md.split('\n').slice(0, 4)).toEqual(['## A', '- id: t_a', '- status: open', '- priority: urgent']);
  });

  it('leaves a normal task with no priority line at all', () => {
    // The whole reason absence is the default: a repo whose owner never sets a
    // priority must not have every task block rewritten to say "normal".
    expect(serializeTask(task({ id: 't_a', title: 'A' }), 'acme')).not.toContain('- priority:');
  });

  it('round-trips the field byte for byte', () => {
    const md = ['## A', '- id: t_a', '- status: open', '- priority: low', '- created: 2026-07-01', ''].join('\n');
    expect(serializeTask(parse(md)[0], 'acme') + '\n').toBe(md);
  });
});

// The real config → indexer → db path, in memory, so what lands in the file is
// what the app would actually commit.
describe('setting a priority through the services', () => {
  let store: Store;
  let fm: FileMap;

  const acme = () => fm.text.get('clients/acme.md') ?? '';
  const first = () => store.db.getAllTasks().find((t) => t.clientIds.includes('acme'));

  beforeEach(async () => {
    fm = new FileMap();
    fm.text.set(
      '.worklog/config.json',
      JSON.stringify({
        hoursPerDay: 8,
        clients: [{ id: 'acme', name: 'Acme Corp' }],
        statuses: [
          { id: 'open', label: 'Open' },
          { id: 'done', label: 'Closed', terminal: true },
        ],
      }),
    );
    fm.text.set('clients/acme.md', '# Acme Corp\n');
    for (const path of fm.text.keys()) {
      fm.remote.add(path);
    }
    mountFileMap(fm);
    store = new Store();
    await store.rebuild('test');
  });

  it('writes the line for a new task that has one, and nothing for one that does not', async () => {
    await createTask(store, { title: 'Urgent thing', clientId: 'acme', priority: 'urgent' });
    await createTask(store, { title: 'Ordinary thing', clientId: 'acme' });
    expect(acme()).toContain('- priority: urgent');
    expect(acme().match(/- priority:/g)).toHaveLength(1);
  });

  it('refuses a value off the scale rather than writing it', async () => {
    await createTask(store, { title: 'Made-up thing', clientId: 'acme', priority: 'critical' });
    expect(acme()).not.toContain('- priority:');
  });

  it('raises, lowers and clears an existing task', async () => {
    await createTask(store, { title: 'Thing', clientId: 'acme' });
    const id = first()?.id as string;

    await updateTask(store, id, { priority: 'high' });
    expect(store.db.getTask(id)?.priority).toBe('high');

    await updateTask(store, id, { priority: 'low' });
    expect(acme()).toContain('- priority: low');

    // '' is how the form says "back to normal", and normal is no line at all.
    await updateTask(store, id, { priority: '' });
    expect(store.db.getTask(id)?.priority).toBeUndefined();
    expect(acme()).not.toContain('- priority:');
  });

  it('leaves the priority alone on an edit that does not mention it', async () => {
    await createTask(store, { title: 'Thing', clientId: 'acme', priority: 'high' });
    const id = first()?.id as string;
    await updateTask(store, id, { title: 'Renamed thing' });
    expect(store.db.getTask(id)?.priority).toBe('high');
  });
});
