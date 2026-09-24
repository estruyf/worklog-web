// The pure derivations behind the meeting views: when an action item counts as
// done, which meeting was "last time", the Meetings list's filter, and the
// search group. No React — the views only render what these return.

import { describe, it, expect } from 'vitest';
import type { Meeting, Task } from '../src/model/types';
import { filterMeetings, isActionDone, openActionCount, previousMeeting } from '../src/ui/utils/meetings';
import { deriveMeetingGroup, type SearchFilters } from '../src/ui/utils/search';

function meeting(id: string, fields: Partial<Meeting>): Meeting {
  return { id, title: id, date: '2026-09-01', people: [], notes: '', actions: [], sourceFile: '', sourceLine: 0, ...fields };
}

function task(id: string, completed?: string): Task {
  return { id, title: id, status: 'open', clientIds: ['acme'], links: [], completed, sourceFile: '', sourceLine: 0 };
}

// Most recent first — the order the snapshot holds them in.
const MEETINGS: Meeting[] = [
  meeting('m_c', { title: 'Acme sync', date: '2026-09-24', time: '10:00', clientId: 'acme', people: ['Sam Jones'], notes: 'Export is late.' }),
  meeting('m_b', {
    title: 'Acme sync',
    date: '2026-09-17',
    time: '10:00',
    clientId: 'acme',
    people: ['Sam Jones', 'Priya'],
    actions: [{ text: 'Send the sample', done: false, taskId: 't_1' }, { text: 'Book a room', done: true }],
  }),
  meeting('m_a', { title: 'Globex intro', date: '2026-09-17', time: '09:00', clientId: 'globex', people: ['Dana'] }),
];

describe('action items', () => {
  const tasks = new Map([['t_1', task('t_1', '2026-09-20')]]);

  it('follows the task an item became, not its own box', () => {
    expect(isActionDone({ text: 'x', done: false, taskId: 't_1' }, tasks)).toBe(true);
    expect(isActionDone({ text: 'x', done: true, taskId: 't_1' }, new Map([['t_1', task('t_1')]]))).toBe(false);
  });

  it('falls back to its own box when the task is gone', () => {
    expect(isActionDone({ text: 'x', done: true, taskId: 't_gone' }, tasks)).toBe(true);
  });

  it('counts what is still open', () => {
    expect(openActionCount(MEETINGS[1], new Map())).toBe(1);
    expect(openActionCount(MEETINGS[1], tasks)).toBe(0);
  });
});

describe('previousMeeting', () => {
  it('is the last meeting with the same client before this one', () => {
    expect(previousMeeting(MEETINGS, MEETINGS[0])?.id).toBe('m_b');
  });

  it('is nothing for the first one, or for a meeting with no client', () => {
    expect(previousMeeting(MEETINGS, MEETINGS[1])).toBeUndefined();
    expect(previousMeeting(MEETINGS, meeting('m_x', { date: '2026-10-01' }))).toBeUndefined();
  });
});

describe('filterMeetings', () => {
  const none = { client: '', person: '', query: '' };

  it('narrows by client and by person', () => {
    expect(filterMeetings(MEETINGS, { ...none, client: 'globex' }).map((m) => m.id)).toEqual(['m_a']);
    expect(filterMeetings(MEETINGS, { ...none, person: 'priya' }).map((m) => m.id)).toEqual(['m_b']);
  });

  it('searches the notes and the action items as well as the title', () => {
    expect(filterMeetings(MEETINGS, { ...none, query: 'late' }).map((m) => m.id)).toEqual(['m_c']);
    expect(filterMeetings(MEETINGS, { ...none, query: 'room' }).map((m) => m.id)).toEqual(['m_b']);
  });
});

describe('deriveMeetingGroup', () => {
  const filters = (patch: Partial<SearchFilters>): SearchFilters => ({ query: '', scope: 'all', client: '', tags: [], ...patch });
  const open = (id: string) => () => void id;

  it('finds a meeting by the person in it and says so in the snippet', () => {
    const group = deriveMeetingGroup(MEETINGS, filters({ query: 'dana' }), { onOpen: open });
    expect(group?.rows.map((r) => r.title)).toEqual(['Globex intro']);
    expect(group?.rows[0].snippet).toContain('Dana');
    expect(group?.rows[0].kind).toBe('meeting');
  });

  it('honours the client filter rather than hiding every meeting', () => {
    expect(deriveMeetingGroup(MEETINGS, filters({ query: 'sync', client: 'acme' }), { onOpen: open })?.count).toBe(2);
    expect(deriveMeetingGroup(MEETINGS, filters({ query: 'sync', client: 'globex' }), { onOpen: open })).toBeUndefined();
  });

  it('stays out of a tag search and the open/archived scopes', () => {
    expect(deriveMeetingGroup(MEETINGS, filters({ query: 'sync', tags: ['bug'] }), { onOpen: open })).toBeUndefined();
    expect(deriveMeetingGroup(MEETINGS, filters({ query: 'sync', scope: 'open' }), { onOpen: open })).toBeUndefined();
  });
});
