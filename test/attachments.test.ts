// Task attachments: the `- attachment:` record round-trips, adding one stores
// the bytes under `assets/` beside the record, and deleting one removes both.
// The whole stack is in-memory, so these run the real service → markdown →
// indexer path.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { addTaskAttachment, deleteTaskAttachment } from '../src/services/taskOps';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';

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

## Rebuild the reporting export
- id: t_acme01
- status: open
- link: https://example.com/issues/263 Tracking issue
- attachment: assets/export-spec.pdf
- created: 2026-07-01

## Ship the invoice export
- id: t_acme02
- status: open
- created: 2026-07-02
`;

let store: Store;
let fm: FileMap;

const base64 = (text: string) => Buffer.from(text).toString('base64');

function attachments(id = 't_acme01'): string[] {
  return store.db.getTask(id)?.attachments ?? [];
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

describe('attachment parsing', () => {
  it('reads the whole value as the ref, spaces included', () => {
    const md = '## T\n- id: t_1\n- attachment: assets/timeout trace.txt\n';
    const [t] = parseTaskFile(md, 'clients/acme.md', 'acme').tasks;
    expect(t.attachments).toEqual(['assets/timeout trace.txt']);
  });

  it('serializes attachment lines back after the links', () => {
    const [t] = parseTaskFile(ACME_MD, 'clients/acme.md', 'acme').tasks;
    expect(serializeTask(t, 'acme')).toContain(
      '- link: https://example.com/issues/263 Tracking issue\n- attachment: assets/export-spec.pdf\n- created: 2026-07-01',
    );
  });
});

describe('addTaskAttachment', () => {
  it('stores the bytes under assets/ and records the ref on the task', async () => {
    await addTaskAttachment(store, 't_acme02', 'notes.txt', base64('hello'));

    expect(attachments('t_acme02')).toEqual(['assets/notes.txt']);
    expect(fm.binary.get('assets/notes.txt')).toEqual(new Uint8Array(Buffer.from('hello')));
    expect(fm.text.get('clients/acme.md')).toContain('- attachment: assets/notes.txt');
  });

  it('sanitizes the picked filename to one unambiguous token', async () => {
    await addTaskAttachment(store, 't_acme02', 'Q3 Report (final).pdf', base64('pdf'));

    expect(attachments('t_acme02')).toEqual(['assets/Q3-Report-final.pdf']);
  });

  it('keeps a colliding name unique instead of overwriting the branch or the map', async () => {
    fm.baseSha.set('assets/notes.txt', 'sha-on-branch');
    await addTaskAttachment(store, 't_acme01', 'notes.txt', base64('one'));
    await addTaskAttachment(store, 't_acme01', 'notes.txt', base64('two'));

    expect(attachments()).toEqual(['assets/export-spec.pdf', 'assets/notes-2.txt', 'assets/notes-3.txt']);
    expect(fm.binary.has('assets/notes.txt')).toBe(false);
  });

  it('rejects an oversized file before writing anything', async () => {
    const big = base64('x'.repeat(11 * 1024 * 1024));
    await expect(addTaskAttachment(store, 't_acme01', 'big.bin', big)).rejects.toThrow('too large');
    expect(attachments()).toEqual(['assets/export-spec.pdf']);
  });
});

describe('deleteTaskAttachment', () => {
  it('removes the record and the local-only file outright', async () => {
    await addTaskAttachment(store, 't_acme02', 'notes.txt', base64('hello'));
    await deleteTaskAttachment(store, 't_acme02', 'assets/notes.txt');

    expect(attachments('t_acme02')).toEqual([]);
    expect(fm.binary.has('assets/notes.txt')).toBe(false);
    expect(fm.deleted.has('assets/notes.txt')).toBe(false);
    expect(fm.text.get('clients/acme.md')).not.toContain('- attachment: assets/notes.txt');
  });

  it('marks a file the branch holds as a tree deletion for the next push', async () => {
    fm.remote.add('assets/export-spec.pdf');
    await deleteTaskAttachment(store, 't_acme01', 'assets/export-spec.pdf');

    expect(attachments()).toEqual([]);
    expect(fm.deleted.has('assets/export-spec.pdf')).toBe(true);
    expect(fm.dirty.has('assets/export-spec.pdf')).toBe(true);
  });

  it('drops a ref pointing outside assets/ without following it to a deletion', async () => {
    fm.text.set('clients/acme.md', ACME_MD.replace('- attachment: assets/export-spec.pdf', '- attachment: clients/acme.md'));
    await store.rebuild('test');

    await deleteTaskAttachment(store, 't_acme01', 'clients/acme.md');

    expect(attachments()).toEqual([]);
    expect(fm.text.has('clients/acme.md')).toBe(true);
  });
});
