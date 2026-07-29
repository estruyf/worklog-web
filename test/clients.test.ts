// Integration tests for retiring a client: archiving (reversible, keeps every
// file) and deleting (only for a client that never accumulated history). The
// whole stack is in-memory, so these run the real config → indexer → db path.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { createClient, deleteClient, setClientArchived, clientUsage, updateClient } from '../src/services/tasks';
import type { DaylogConfig } from '../src/model/types';

const CONFIG = {
  hoursPerDay: 8,
  weekStart: 'monday',
  clients: [
    { id: 'acme', name: 'Acme Corp' },
    { id: 'billed', name: 'Billed Only' },
    { id: 'empty', name: 'Empty Co' },
  ],
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
`;

let store: Store;
let fm: FileMap;

async function config(): Promise<DaylogConfig> {
  return store.ws.loadConfig();
}

beforeEach(async () => {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', ACME_MD);
  fm.text.set('clients/billed.md', '# Billed Only\n');
  fm.text.set('clients/empty.md', '# Empty Co\n');
  fm.text.set('worklog/2026-07.md', '# Worklog 2026-07\n\n- 2026-07-01 acme 8\n- 2026-07-02 billed 4\n');
  // Stand in for a loaded repo: every file is already on the branch.
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
});

describe('clientUsage', () => {
  it('counts the tasks and ledger entries a client carries', () => {
    expect(clientUsage(store, 'acme')).toEqual({ tasks: 1, worklog: 1 });
    expect(clientUsage(store, 'billed')).toEqual({ tasks: 0, worklog: 1 });
    expect(clientUsage(store, 'empty')).toEqual({ tasks: 0, worklog: 0 });
  });
});

describe('client description and links', () => {
  const clientIn = async (id: string) => (await config()).clients.find((c) => c.id === id);

  it('stores the notes and links a new client is created with', async () => {
    await createClient(store, {
      name: 'Globex',
      description: 'Contact: Jane. **Net 30.**',
      links: [{ url: 'https://github.com/globex/site', label: 'Repo' }, { url: 'https://globex.example' }],
    });

    expect(await clientIn('globex')).toMatchObject({
      description: 'Contact: Jane. **Net 30.**',
      links: [{ url: 'https://github.com/globex/site', label: 'Repo' }, { url: 'https://globex.example' }],
    });
    expect(store.db.getClients().find((c) => c.id === 'globex')?.links).toHaveLength(2);
  });

  it('drops half-filled link rows and blank labels instead of persisting them', async () => {
    await createClient(store, {
      name: 'Globex',
      links: [{ url: '  ', label: 'Nothing' }, { url: ' https://globex.example ', label: '  ' }],
    });

    expect((await clientIn('globex'))?.links).toEqual([{ url: 'https://globex.example' }]);
  });

  it('leaves both fields absent when a client is created without them', async () => {
    await createClient(store, { name: 'Globex' });

    const raw = fm.text.get('.worklog/config.json')!;
    expect(raw).not.toContain('description');
    expect(raw).not.toContain('links');
  });

  it('adds and replaces them on an existing client without touching its files', async () => {
    await updateClient(store, 'acme', { description: 'Rate: €X/day', links: [{ url: 'https://acme.example' }] });

    expect(await clientIn('acme')).toMatchObject({ description: 'Rate: €X/day', links: [{ url: 'https://acme.example' }] });
    expect([...fm.dirty]).toEqual(['.worklog/config.json']);
    expect(fm.text.get('clients/acme.md')).toBe(ACME_MD);
  });

  it('keeps the fields a partial update leaves out', async () => {
    await updateClient(store, 'acme', { description: 'Rate: €X/day', links: [{ url: 'https://acme.example' }] });
    await updateClient(store, 'acme', { name: 'Acme Corporation' });

    expect(await clientIn('acme')).toMatchObject({
      name: 'Acme Corporation',
      description: 'Rate: €X/day',
      links: [{ url: 'https://acme.example' }],
    });
  });

  it('clears them by dropping the keys rather than writing empty values', async () => {
    await updateClient(store, 'acme', { description: 'Rate: €X/day', links: [{ url: 'https://acme.example' }] });
    await updateClient(store, 'acme', { description: '   ', links: [] });

    const acme = await clientIn('acme');
    expect(acme?.description).toBeUndefined();
    expect(acme?.links).toBeUndefined();
    expect(fm.text.get('.worklog/config.json')).not.toContain('acme.example');
  });

  it('tolerates a hand-edited config: bare url strings in, junk entries out', async () => {
    fm.text.set(
      '.worklog/config.json',
      JSON.stringify({ ...CONFIG, clients: [{ id: 'acme', name: 'Acme Corp', description: '  ', links: ['https://acme.example', null, { label: 'No url' }] }] }, null, 2),
    );

    const acme = (await config()).clients[0];
    expect(acme.links).toEqual([{ url: 'https://acme.example' }]);
    expect(acme.description).toBeUndefined();
  });
});

describe('setClientArchived', () => {
  it('flags the client in config.json without touching any other file', async () => {
    await setClientArchived(store, 'acme', true);

    expect((await config()).clients.find((c) => c.id === 'acme')?.archived).toBe(true);
    expect(store.db.getClients().find((c) => c.id === 'acme')?.archived).toBe(true);
    // Only config.json moved — the tasks and ledger stay exactly where they are.
    expect([...fm.dirty]).toEqual(['.worklog/config.json']);
    expect(fm.text.get('clients/acme.md')).toBe(ACME_MD);
  });

  it('restores by dropping the flag rather than writing false', async () => {
    await setClientArchived(store, 'acme', true);
    await setClientArchived(store, 'acme', false);

    expect((await config()).clients.find((c) => c.id === 'acme')?.archived).toBeUndefined();
    expect(fm.text.get('.worklog/config.json')).not.toContain('archived');
  });

  it('rejects an unknown client', async () => {
    await expect(setClientArchived(store, 'nope', true)).rejects.toThrow(/Unknown client/);
  });
});

describe('deleteClient', () => {
  it('removes a client with no history, and its file with it', async () => {
    await deleteClient(store, 'empty');

    expect((await config()).clients.map((c) => c.id)).toEqual(['acme', 'billed']);
    expect(store.db.getClients().some((c) => c.id === 'empty')).toBe(false);
    expect(fm.text.has('clients/empty.md')).toBe(false);
    // The branch has the file, so the deletion has to travel in the next commit.
    expect(fm.deleted.has('clients/empty.md')).toBe(true);
    expect(fm.dirty.has('clients/empty.md')).toBe(true);
  });

  it('refuses a client that still has tasks', async () => {
    await expect(deleteClient(store, 'acme')).rejects.toThrow(/Archive it instead/);
    expect((await config()).clients.map((c) => c.id)).toContain('acme');
    expect(fm.text.has('clients/acme.md')).toBe(true);
  });

  it('refuses a client that only has logged time', async () => {
    await expect(deleteClient(store, 'billed')).rejects.toThrow(/1 time entry/);
    expect(fm.text.has('clients/billed.md')).toBe(true);
  });

  it('drops a never-synced file outright instead of queueing a deletion', async () => {
    fm.remote.delete('clients/empty.md');
    await deleteClient(store, 'empty');

    expect(fm.deleted.has('clients/empty.md')).toBe(false);
    expect(fm.dirty.has('clients/empty.md')).toBe(false);
  });
});
