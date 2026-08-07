// The day view's links panel. What matters is *which* clients it speaks for:
// the ones whose work the day actually shows, so the panel changes with the day
// instead of listing every client the repo has ever had.

import { describe, it, expect } from 'vitest';
import type { Client, Task, WorklogEntry } from '../src/model/types';
import { deriveClientLinks, relevantDayClientIds } from '../src/ui/utils/clientLinks';
import { eventWorklogClientId } from '../src/model/worklog';
import { GENERAL_TODO_CLIENT_ID } from '../src/model/todos';

const client = (id: string, links?: { url: string; label?: string }[]): Client => ({
  id,
  name: id.toUpperCase(),
  ...(links ? { links } : {}),
});

const task = (id: string, clientId: string): Task =>
  ({ id, title: id, clientIds: [clientId], links: [], tags: [] }) as unknown as Task;

const log = (clientId: string, hours = 1): WorklogEntry => ({ date: '2026-08-07', clientId, hours });

const colorOf = (id: string) => '#' + id.slice(0, 3);

describe('relevantDayClientIds', () => {
  it('takes the clients that booked time on the day', () => {
    expect([...relevantDayClientIds([log('acme'), log('globex')], [])]).toEqual(['acme', 'globex']);
  });

  it('takes the clients of the tasks the day puts on screen', () => {
    expect([...relevantDayClientIds([], [task('t1', 'acme'), task('t2', 'globex')])]).toEqual(['acme', 'globex']);
  });

  it('counts a client once however many logs and tasks it has', () => {
    const ids = relevantDayClientIds([log('acme', 2), log('acme', 3)], [task('t1', 'acme'), task('t2', 'acme')]);
    expect([...ids]).toEqual(['acme']);
  });

  it('leaves out event entries — a day off is not a client', () => {
    const ids = relevantDayClientIds([log(eventWorklogClientId('holiday')), log('acme')], []);
    expect([...ids]).toEqual(['acme']);
  });

  it('leaves out the general to-do bucket, which is a pseudo-client', () => {
    const ids = relevantDayClientIds([], [task('t1', GENERAL_TODO_CLIENT_ID), task('t2', 'acme')]);
    expect([...ids]).toEqual(['acme']);
  });

  it('is empty for a day with nothing logged and nothing due', () => {
    expect(relevantDayClientIds([], []).size).toBe(0);
  });
});

describe('deriveClientLinks', () => {
  const clients = [
    client('acme', [{ url: 'https://acme.example/board', label: 'Board' }, { url: 'https://github.com/acme' }]),
    client('globex', [{ url: 'https://globex.example' }]),
    client('initech'),
  ];

  it('returns only the clients that are on the day and have links', () => {
    const groups = deriveClientLinks(clients, new Set(['acme', 'initech']), colorOf);
    expect(groups.map((g) => g.id)).toEqual(['acme']);
    expect(groups[0]).toMatchObject({ name: 'ACME', color: '#acm' });
    expect(groups[0].links).toHaveLength(2);
  });

  it('keeps config order rather than the order the ids came in', () => {
    const groups = deriveClientLinks(clients, new Set(['globex', 'acme']), colorOf);
    expect(groups.map((g) => g.id)).toEqual(['acme', 'globex']);
  });

  it('still speaks for an archived client that logged time before it was retired', () => {
    const retired = [...clients, { ...client('oldco', [{ url: 'https://oldco.example' }]), archived: true }];
    expect(deriveClientLinks(retired, new Set(['oldco']), colorOf).map((g) => g.id)).toEqual(['oldco']);
  });

  it('is empty when the day has clients but none of them carry links', () => {
    expect(deriveClientLinks(clients, new Set(['initech']), colorOf)).toEqual([]);
  });
});
