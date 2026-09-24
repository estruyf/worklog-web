// Meeting notes: what the parser reads out of `meetings/<YYYY-MM>.md`, what the
// service writes back, and how two devices editing meetings in one month merge.
//
// The property under test throughout is that the file stays something a person
// can hand-edit: an action-items heading followed by prose is prose, and a
// meeting nobody touched comes back byte for byte.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import {
  formatDuration,
  joinMeetingFile,
  normalizeTime,
  parseDuration,
  parseMeetingFile,
  serializeMeeting,
  upsertMeeting,
} from '../src/parser/meetingParser';
import { splitTaskBlocks } from '../src/parser/blocks';
import { createMeeting, createTaskFromAction, deleteMeeting, updateMeeting } from '../src/services/meetings';
import { mergeFile } from '../src/data/merge';
import { isWorklogPath } from '../src/server/github';
import { autoSyncEventFor } from '../src/model/syncEvents';
import type { Meeting } from '../src/model/types';

const CONFIG = {
  hoursPerDay: 8,
  clients: [
    { id: 'acme', name: 'Acme Corp' },
    { id: 'old', name: 'Old Co', archived: true },
  ],
};

const JULY = `# Meetings 2026-07

## Acme weekly sync
- id: m_sync01
- date: 2026-07-14
- time: 10:00
- duration: 45m
- client: acme
- people: Sam Jones, Priya Shah

Sam confirmed the CSV column order.

## Not a meeting, just prose

### Action items
- [ ] Send Priya a sample export → t_ab12cd
- [x] Check staging credentials

## Retro
- id: m_retro1
- date: 2026-07-20

### Action items
Nothing came out of it, which is itself worth writing down.
`;

let store: Store;
let fm: FileMap;

async function mount(files: Record<string, string> = {}) {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('clients/acme.md', '# Acme Corp\n');
  fm.text.set('meetings/2026-07.md', JULY);
  for (const [path, text] of Object.entries(files)) {
    fm.text.set(path, text);
  }
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
}

function meeting(id: string): Meeting {
  const found = store.db.getMeeting(id);
  if (!found) {
    throw new Error(`no meeting ${id}`);
  }
  return found;
}

beforeEach(() => mount());

describe('parsing a meetings file', () => {
  it('reads the meta lines, the notes and the action items', () => {
    const [sync] = parseMeetingFile(JULY, 'meetings/2026-07.md');
    expect(sync).toMatchObject({
      id: 'm_sync01',
      title: 'Acme weekly sync',
      date: '2026-07-14',
      time: '10:00',
      duration: 45,
      clientId: 'acme',
      people: ['Sam Jones', 'Priya Shah'],
      sourceLine: 2,
    });
    // A `## ` heading without an id is the notes' own heading, not a new meeting.
    expect(sync.notes).toBe('Sam confirmed the CSV column order.\n\n## Not a meeting, just prose');
    expect(sync.actions).toEqual([
      { text: 'Send Priya a sample export', done: false, taskId: 't_ab12cd' },
      { text: 'Check staging credentials', done: true },
    ]);
  });

  it('reads an action-items heading followed by prose as prose', () => {
    const retro = parseMeetingFile(JULY, 'meetings/2026-07.md')[1];
    expect(retro.actions).toEqual([]);
    expect(retro.notes).toBe('### Action items\nNothing came out of it, which is itself worth writing down.');
  });

  it('skips a block without an id', () => {
    expect(parseMeetingFile('# Meetings\n\n## Loose heading\n\ntext\n', 'x')).toEqual([]);
  });

  it('round-trips every meeting through serialize', () => {
    for (const m of parseMeetingFile(JULY, 'x')) {
      const again = parseMeetingFile(serializeMeeting(m), 'x')[0];
      expect({ ...again, sourceLine: 0 }).toEqual({ ...m, sourceLine: 0 });
    }
  });

  it('rewrites a canonical file byte for byte', () => {
    const { header, blocks } = splitTaskBlocks(JULY);
    const meetings = parseMeetingFile(JULY, 'x');
    expect(joinMeetingFile(header, meetings.map(serializeMeeting))).toBe(JULY);
    expect(joinMeetingFile(header, blocks.map((b) => b.text))).toBe(JULY);
  });
});

describe('durations and times', () => {
  it('reads the shapes a person writes', () => {
    expect(parseDuration('45m')).toBe(45);
    expect(parseDuration('1h')).toBe(60);
    expect(parseDuration('1h30m')).toBe(90);
    expect(parseDuration('1h 30m')).toBe(90);
    expect(parseDuration('1.5h')).toBe(90);
    expect(parseDuration('30')).toBe(30);
    expect(parseDuration('20 min')).toBe(20);
    expect(parseDuration('soon')).toBeUndefined();
    expect(parseDuration('0m')).toBeUndefined();
  });

  it('writes the short form', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(95)).toBe('1h35m');
  });

  it('normalizes a clock time', () => {
    expect(normalizeTime('9:05')).toBe('09:05');
    expect(normalizeTime('24:00')).toBeUndefined();
    expect(normalizeTime('noon')).toBeUndefined();
  });
});

describe('upsertMeeting', () => {
  const base: Meeting = {
    id: 'm_new001',
    title: 'Kickoff',
    date: '2026-07-16',
    people: [],
    notes: '',
    actions: [],
    sourceFile: '',
    sourceLine: 0,
  };

  it('inserts a new meeting in date order', () => {
    const next = upsertMeeting(JULY, '2026-07', base);
    expect(parseMeetingFile(next, 'x').map((m) => m.id)).toEqual(['m_sync01', 'm_new001', 'm_retro1']);
  });

  it('starts a file with its month heading', () => {
    expect(upsertMeeting(undefined, '2026-09', { ...base, date: '2026-09-01' })).toBe(
      '# Meetings 2026-09\n\n## Kickoff\n- id: m_new001\n- date: 2026-09-01\n',
    );
  });
});

describe('the meetings service', () => {
  it('creates a meeting in its month file', async () => {
    const m = await createMeeting(store, { date: '2026-09-24', time: '9:30', clientId: 'acme', people: ['Sam', 'sam', ' '] });
    expect(m.id).toMatch(/^m_[a-z0-9]{6}$/);
    expect(meeting(m.id)).toMatchObject({ title: 'Meeting', time: '09:30', clientId: 'acme', people: ['Sam'] });
    expect(fm.text.get('meetings/2026-09.md')).toContain('- id: ' + m.id);
    expect(fm.dirty.has('meetings/2026-09.md')).toBe(true);
  });

  it('edits the fields it is given and leaves the rest', async () => {
    await updateMeeting(store, 'm_sync01', { notes: 'Rewritten.', duration: 50, people: ['Sam Jones', 'Lee, Ann'] });
    const m = meeting('m_sync01');
    expect(m.notes).toBe('Rewritten.');
    expect(m.duration).toBe(50);
    // A comma inside a name would split it on the next read.
    expect(m.people).toEqual(['Sam Jones', 'Lee Ann']);
    expect(m.actions).toHaveLength(2);
    expect(m.clientId).toBe('acme');
  });

  it('clears an optional field on null', async () => {
    await updateMeeting(store, 'm_sync01', { time: null, duration: null, clientId: null });
    const m = meeting('m_sync01');
    expect(m.time).toBeUndefined();
    expect(m.duration).toBeUndefined();
    expect(m.clientId).toBeUndefined();
  });

  it('moves a meeting to another month file when its date moves', async () => {
    await updateMeeting(store, 'm_sync01', { date: '2026-08-03' });
    expect(fm.text.get('meetings/2026-07.md')).not.toContain('m_sync01');
    expect(fm.text.get('meetings/2026-08.md')).toContain('m_sync01');
    expect(meeting('m_sync01').sourceFile).toBe('meetings/2026-08.md');
    expect(meeting('m_retro1').sourceFile).toBe('meetings/2026-07.md');
  });

  it('deletes a meeting and leaves its neighbours', async () => {
    await deleteMeeting(store, 'm_sync01');
    expect(store.db.getMeeting('m_sync01')).toBeUndefined();
    expect(fm.text.get('meetings/2026-07.md')).toBe(
      '# Meetings 2026-07\n\n## Retro\n- id: m_retro1\n- date: 2026-07-20\n\n### Action items\nNothing came out of it, which is itself worth writing down.\n',
    );
  });

  it('turns an action item into a task on the meeting’s client', async () => {
    const task = await createTaskFromAction(store, 'm_sync01', 1);
    expect(task).toBeDefined();
    expect(store.db.getTask(task!.id)).toMatchObject({ title: 'Check staging credentials', clientIds: ['acme'] });
    expect(meeting('m_sync01').actions[1].taskId).toBe(task!.id);
    expect(fm.text.get('meetings/2026-07.md')).toContain(`- [x] Check staging credentials → ${task!.id}`);
  });

  it('does not mint a second task for an item already linked', async () => {
    expect(await createTaskFromAction(store, 'm_sync01', 0)).toBeUndefined();
  });

  it('files the task as a to-do when the client is archived or absent', async () => {
    const m = await createMeeting(store, { date: '2026-09-24', clientId: 'old' });
    await updateMeeting(store, m.id, { actions: [{ text: 'Follow up', done: false }] });
    const task = await createTaskFromAction(store, m.id, 0);
    expect(store.db.getTask(task!.id)?.clientIds).toEqual(['todos']);
  });

  it('refuses to edit a meeting that is gone', async () => {
    await expect(updateMeeting(store, 'm_gone00', { notes: 'x' })).rejects.toThrow(/no longer exists/);
  });
});

describe('syncing meetings', () => {
  it('is a path the app will read and write', () => {
    expect(isWorklogPath('meetings/2026-07.md')).toBe(true);
    expect(isWorklogPath('meetings/nested/2026-07.md')).toBe(false);
    expect(isWorklogPath('meetings/2026-07.txt')).toBe(false);
  });

  it('merges two devices editing different meetings in one month', () => {
    const local = JULY.replace('Sam confirmed the CSV column order.', 'Sam confirmed it, in writing.');
    const remote = JULY.replace('- date: 2026-07-20', '- date: 2026-07-20\n- duration: 30m');

    const merged = mergeFile('meetings/2026-07.md', { base: JULY, local, remote });

    expect(merged.conflicts).toEqual([]);
    const meetings = parseMeetingFile(merged.text, 'x');
    expect(meetings[0].notes).toContain('in writing');
    expect(meetings[1].duration).toBe(30);
  });

  it('keeps the local meeting and reports one both devices edited', () => {
    const local = JULY.replace('Sam confirmed', 'Here, Sam confirmed');
    const remote = JULY.replace('Sam confirmed', 'There, Sam confirmed');

    const merged = mergeFile('meetings/2026-07.md', { base: JULY, local, remote });

    expect(merged.text).toContain('Here, Sam confirmed');
    expect(merged.conflicts).toHaveLength(1);
  });

  it('merges to the same bytes when nothing changed', () => {
    expect(mergeFile('meetings/2026-07.md', { base: JULY, local: JULY, remote: JULY }).text).toBe(JULY);
  });

  it('counts every meeting edit as the meeting event', () => {
    for (const reason of ['addMeeting', 'updateMeeting', 'deleteMeeting', 'linkMeetingTask']) {
      expect(autoSyncEventFor(reason), reason).toBe('meeting');
    }
  });
});
