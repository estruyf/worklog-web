// Three-way merge tests. These guard the property that makes multi-device use
// safe: a file changed by two instances keeps both sets of changes, because a
// commit writes whole files and whatever isn't merged in is silently lost.

import { describe, it, expect } from 'vitest';
import { mergeFile } from '../src/data/merge';

const CLIENT = 'clients/acme.md';

function block(id: string, title: string, status = 'open'): string {
  return `## ${title}\n- id: ${id}\n- status: ${status}\n- created: 2026-07-01`;
}

function file(...blocks: string[]): string {
  return `# Acme Corp\n\n${blocks.join('\n\n')}\n`;
}

describe('mergeFile — task files', () => {
  it('keeps a task added here and an edit made on the branch', () => {
    const base = file(block('t_a', 'Existing task'));
    const local = file(block('t_a', 'Existing task'), block('t_b', 'New task'));
    const remote = file(block('t_a', 'Existing task', 'in-progress'));

    const { text, conflicts } = mergeFile(CLIENT, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).toContain('- id: t_b');
    expect(text).toContain('- status: in-progress');
  });

  it('keeps tasks added on both sides', () => {
    const base = file(block('t_a', 'Existing task'));
    const local = file(block('t_a', 'Existing task'), block('t_b', 'Mine'));
    const remote = file(block('t_a', 'Existing task'), block('t_c', 'Theirs'));

    const { text, conflicts } = mergeFile(CLIENT, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).toContain('## Mine');
    expect(text).toContain('## Theirs');
    expect(text).toContain('## Existing task');
  });

  it('honours a delete made on one side only', () => {
    const base = file(block('t_a', 'Doomed'), block('t_b', 'Kept'));
    const local = file(block('t_b', 'Kept'));
    const remote = file(block('t_a', 'Doomed'), block('t_b', 'Kept'), block('t_c', 'Added there'));

    const { text, conflicts } = mergeFile(CLIENT, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).not.toContain('t_a');
    expect(text).toContain('t_c');
  });

  it('keeps the local version and reports a task changed on both sides', () => {
    const base = file(block('t_a', 'Task'));
    const local = file(block('t_a', 'Task', 'done'));
    const remote = file(block('t_a', 'Task', 'blocked'));

    const { text, conflicts } = mergeFile(CLIENT, { base, local, remote });

    expect(text).toContain('- status: done');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('t_a');
  });

  it('resurrects a file the branch deleted but this instance edited', () => {
    const base = file(block('t_a', 'Task'));
    const local = file(block('t_a', 'Task'), block('t_b', 'New'));

    const { text, conflicts } = mergeFile(CLIENT, { base, local, remote: undefined });

    expect(text).toContain('t_b');
    expect(conflicts).toHaveLength(1);
  });

  it('round-trips to identical content when only one side changed', () => {
    const base = file(block('t_a', 'Task'));
    const local = file(block('t_a', 'Task'), block('t_b', 'New'));

    expect(mergeFile(CLIENT, { base, local, remote: base }).text).toBe(local);
    expect(mergeFile(CLIENT, { base, local: base, remote: local }).text).toBe(local);
  });

  it('preserves the notes and body of a block it carries over', () => {
    const rich = `## Rebuild the export\n- id: t_a\n- status: open\n- created: 2026-07-01\n\nThe current export times out.\n\n### Notes\n- 2026-07-14 — Reproduced it.`;
    const base = file(rich);
    const local = file(rich, block('t_b', 'New'));
    const remote = file(rich, block('t_c', 'Theirs'));

    const { text } = mergeFile(CLIENT, { base, local, remote });

    expect(text).toContain('### Notes');
    expect(text).toContain('The current export times out.');
    expect(text).toContain('- 2026-07-14 — Reproduced it.');
  });
});

describe('mergeFile — worklog ledger', () => {
  const LEDGER = 'worklog/2026-07.md';
  const ledger = (...lines: string[]) => `# Worklog 2026-07\n\n${lines.join('\n')}\n`;

  it('keeps entries logged on both sides', () => {
    const base = ledger('- 2026-07-01 acme 8');
    const local = ledger('- 2026-07-01 acme 8', '- 2026-07-02 acme 4');
    const remote = ledger('- 2026-07-01 acme 8', '- 2026-07-03 globex 8');

    const { text, conflicts } = mergeFile(LEDGER, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).toContain('- 2026-07-02 acme 4');
    expect(text).toContain('- 2026-07-03 globex 8');
  });

  it('treats the same day+client as one record', () => {
    const base = ledger('- 2026-07-01 acme 8');
    const local = ledger('- 2026-07-01 acme 4 — half day');
    const remote = ledger('- 2026-07-01 acme 8', '- 2026-07-01 globex 4');

    const { text, conflicts } = mergeFile(LEDGER, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).toContain('- 2026-07-01 acme 4 — half day');
    expect(text).toContain('- 2026-07-01 globex 4');
    expect(text).not.toContain('- 2026-07-01 acme 8');
  });

  it('honours a removed entry', () => {
    const base = ledger('- 2026-07-01 acme 8', '- 2026-07-02 acme 8');
    const local = ledger('- 2026-07-01 acme 8');
    const remote = ledger('- 2026-07-01 acme 8', '- 2026-07-02 acme 8', '- 2026-07-03 acme 8');

    const { text } = mergeFile(LEDGER, { base, local, remote });

    expect(text).not.toContain('2026-07-02');
    expect(text).toContain('2026-07-03');
  });
});

describe('mergeFile — config.json', () => {
  const CONFIG = '.worklog/config.json';
  const conf = (o: unknown) => JSON.stringify(o, null, 2) + '\n';

  it('keeps clients added on both sides and a setting changed on one', () => {
    const base = conf({ hoursPerDay: 8, clients: [{ id: 'acme', name: 'Acme' }] });
    const local = conf({ hoursPerDay: 8, clients: [{ id: 'acme', name: 'Acme' }, { id: 'mine', name: 'Mine' }] });
    const remote = conf({ hoursPerDay: 7, clients: [{ id: 'acme', name: 'Acme' }, { id: 'theirs', name: 'Theirs' }] });

    const { text, conflicts } = mergeFile(CONFIG, { base, local, remote });
    const merged = JSON.parse(text!) as { hoursPerDay: number; clients: { id: string }[] };

    expect(conflicts).toEqual([]);
    expect(merged.hoursPerDay).toBe(7);
    expect(merged.clients.map((c) => c.id).sort()).toEqual(['acme', 'mine', 'theirs']);
  });

  it('keeps the local value when both sides changed the same client', () => {
    const base = conf({ clients: [{ id: 'acme', name: 'Acme' }] });
    const local = conf({ clients: [{ id: 'acme', name: 'Acme Ltd' }] });
    const remote = conf({ clients: [{ id: 'acme', name: 'Acme Inc' }] });

    const { text, conflicts } = mergeFile(CONFIG, { base, local, remote });

    expect(text).toContain('Acme Ltd');
    expect(conflicts).toHaveLength(1);
  });

  // `defaultTaskSort` is the first nested object in config.json — every other
  // non-array setting is a scalar. It needs no strategy of its own: `pick3`
  // compares by serialized value, so the object merges whole rather than field
  // by field, which is what a sort key and its direction want.
  it('merges the default task order as one value, not two independent fields', () => {
    const base = conf({ defaultTaskSort: { key: 'created', dir: 'asc' } });
    const local = conf({ defaultTaskSort: { key: 'created', dir: 'asc' } });
    const remote = conf({ defaultTaskSort: { key: 'due', dir: 'desc' } });

    const { text, conflicts } = mergeFile(CONFIG, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(JSON.parse(text!).defaultTaskSort).toEqual({ key: 'due', dir: 'desc' });
  });

  it('keeps the local order when both devices changed it', () => {
    const base = conf({ defaultTaskSort: { key: 'created', dir: 'asc' } });
    const local = conf({ defaultTaskSort: { key: 'created', dir: 'desc' } });
    const remote = conf({ defaultTaskSort: { key: 'title', dir: 'asc' } });

    const { text, conflicts } = mergeFile(CONFIG, { base, local, remote });

    expect(JSON.parse(text!).defaultTaskSort).toEqual({ key: 'created', dir: 'desc' });
    expect(conflicts).toHaveLength(1);
  });

  it('takes the order from the other device when this one never set it', () => {
    const base = conf({ hoursPerDay: 8 });
    const local = conf({ hoursPerDay: 7 });
    const remote = conf({ hoursPerDay: 8, defaultTaskSort: { key: 'created', dir: 'desc' } });

    const { text, conflicts } = mergeFile(CONFIG, { base, local, remote });
    const merged = JSON.parse(text!);

    expect(conflicts).toEqual([]);
    expect(merged.defaultTaskSort).toEqual({ key: 'created', dir: 'desc' });
    expect(merged.hoursPerDay).toBe(7);
  });
});

describe('mergeFile — unknown ancestor', () => {
  it('unions both sides when there is no base to compare against', () => {
    const local = file(block('t_a', 'Mine'));
    const remote = file(block('t_b', 'Theirs'));

    const { text } = mergeFile(CLIENT, { base: undefined, local, remote });

    expect(text).toContain('## Mine');
    expect(text).toContain('## Theirs');
  });
});

describe('mergeFile — day notes', () => {
  const NOTES = 'notes/2026-07.md';
  const notes = (...days: [string, string][]) =>
    `# Notes 2026-07\n\n${days.map(([d, body]) => `## ${d}\n\n${body}`).join('\n\n')}\n`;

  it('keeps notes written for different days on both sides', () => {
    const base = notes(['2026-07-01', 'Kickoff.']);
    const local = notes(['2026-07-01', 'Kickoff.'], ['2026-07-02', 'Mine.']);
    const remote = notes(['2026-07-01', 'Kickoff.'], ['2026-07-03', 'Theirs.']);

    const { text, conflicts } = mergeFile(NOTES, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).toContain('Mine.');
    expect(text).toContain('Theirs.');
  });

  it('keeps the local note and names the day when both sides edited it', () => {
    const base = notes(['2026-07-01', 'Kickoff.']);
    const local = notes(['2026-07-01', 'Mine.']);
    const remote = notes(['2026-07-01', 'Theirs.']);

    const { text, conflicts } = mergeFile(NOTES, { base, local, remote });

    expect(text).toContain('Mine.');
    expect(text).not.toContain('Theirs.');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('the note for 2026-07-01');
  });

  it('honours a note cleared on one side only', () => {
    const base = notes(['2026-07-01', 'Kickoff.'], ['2026-07-02', 'Second.']);
    const local = notes(['2026-07-01', 'Kickoff.']);
    const remote = notes(['2026-07-01', 'Kickoff.'], ['2026-07-02', 'Second.'], ['2026-07-03', 'Third.']);

    const { text, conflicts } = mergeFile(NOTES, { base, local, remote });

    expect(conflicts).toEqual([]);
    expect(text).not.toContain('2026-07-02');
    expect(text).toContain('Third.');
  });

  it('leaves a body’s own markdown headings intact when another day is merged', () => {
    // The one that catches a heading rule loose enough to split inside prose:
    // a shredded body reads as valid markdown and is only noticed much later.
    const body = 'Split the day.\n\n## Scripts\n\nprose\n\n### Resources\n\n- [doc](https://example.com)';
    const base = notes(['2026-07-01', body]);
    const local = notes(['2026-07-01', body], ['2026-07-02', 'Mine.']);
    const remote = notes(['2026-07-01', body], ['2026-07-03', 'Theirs.']);

    const { text } = mergeFile(NOTES, { base, local, remote });

    expect(text).toContain(body);
  });

  it('reproduces the changed side byte for byte when only one side moved', () => {
    // A no-op merge that reformats is a phantom dirty file — it would commit on
    // every sync forever. This is the guard on the split/join pair agreeing.
    const base = notes(['2026-07-01', 'Kickoff.']);
    const local = notes(['2026-07-01', 'Kickoff.'], ['2026-07-02', 'Mine.']);

    expect(mergeFile(NOTES, { base, local, remote: base }).text).toBe(local);
  });

  it('unions both sides when there is no base to compare against', () => {
    const local = notes(['2026-07-01', 'Mine.']);
    const remote = notes(['2026-07-02', 'Theirs.']);

    const { text } = mergeFile(NOTES, { base: undefined, local, remote });

    expect(text).toContain('Mine.');
    expect(text).toContain('Theirs.');
  });
});
