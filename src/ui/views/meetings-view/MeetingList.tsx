import React, { useMemo, useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { Button, Card, EmptyState, Input, LinkButton, SectionLabel, Select, ViewHeader } from '../../primitives';
import { Kbd, MeetingRow } from '../../components';
import { useData } from '../../context';
import { filterMeetings, monthLabel, type MeetingFilters } from '../../utils';

const NO_FILTERS: MeetingFilters = { client: '', person: '', query: '' };

/** Every meeting, newest first, a card per month. Narrowed by client, by person
 *  ("every meeting with Sam") and by what was said. */
export function MeetingList() {
  const { meetings, allClients, knownPeople, startMeetingInContext } = useData();
  const [filters, setFilters] = useState<MeetingFilters>(NO_FILTERS);
  const set = (patch: Partial<MeetingFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const shown = useMemo(() => filterMeetings(meetings, filters), [meetings, filters]);
  const months = useMemo(() => {
    const groups: { ym: string; items: typeof shown }[] = [];
    for (const m of shown) {
      const ym = m.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last?.ym === ym) {
        last.items.push(m);
      } else {
        groups.push({ ym, items: [m] });
      }
    }
    return groups;
  }, [shown]);
  // Only the clients that have a meeting: the filter is for finding meetings, and
  // a client with none can only ever narrow the list to nothing.
  const meetingClients = useMemo(
    () => allClients.filter((c) => meetings.some((m) => m.clientId === c.id)),
    [allClients, meetings],
  );
  const filtered = filters.client !== '' || filters.person !== '' || filters.query.trim() !== '';

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-[10px]">
          <h1 className="text-[24px] font-bold m-0">Meetings</h1>
          <span className="text-control text-neutral-675">
            {meetings.length === 1 ? '1 meeting' : `${meetings.length} meetings`}
          </span>
        </div>
        <Button variant="primary" size="md" onClick={() => void startMeetingInContext()} className="inline-flex items-center gap-[8px]">
          New meeting
          <Kbd>⇧M</Kbd>
        </Button>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-[18px] pb-20">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {meetings.length === 0 ? (
            <EmptyState>
              No meetings yet. Start one when a call begins — the date, the time and the client you are looking at
              are filled in, and what you type is kept on this device until you save it.{' '}
              <LinkButton size="inherit" onClick={() => void startMeetingInContext()} className="italic underline">
                Start a meeting
              </LinkButton>
            </EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <Input
                  size="sm"
                  value={filters.query}
                  onChange={(e) => set({ query: e.target.value })}
                  placeholder="Search notes, titles, people…"
                  aria-label="Search meetings"
                  leading={<SearchIcon size={14} aria-hidden="true" />}
                  clearable
                  onClear={() => set({ query: '' })}
                  className="flex-1 min-w-[200px]"
                />
                <Select size="sm" value={filters.client} onChange={(e) => set({ client: e.target.value })} aria-label="Client">
                  <option value="">All clients</option>
                  {meetingClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Select size="sm" value={filters.person} onChange={(e) => set({ person: e.target.value })} aria-label="Person">
                  <option value="">Anyone</option>
                  {[...knownPeople].sort((a, b) => a.localeCompare(b)).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>

              {months.length === 0 && filtered && (
                <EmptyState>
                  No meetings match these filters.{' '}
                  <LinkButton size="inherit" onClick={() => setFilters(NO_FILTERS)} className="italic underline">
                    Reset
                  </LinkButton>
                </EmptyState>
              )}

              {months.map((g) => (
                <section key={g.ym} className="mb-[30px]">
                  <SectionLabel className="mb-3">{monthLabel(g.ym)}</SectionLabel>
                  <Card padding="list">
                    {g.items.map((m) => (
                      <MeetingRow key={m.id} meeting={m} showDate showActions />
                    ))}
                  </Card>
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
