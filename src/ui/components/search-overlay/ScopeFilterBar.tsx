import React from 'react';
import type { SearchScope } from '../../model';
import { Chip, LinkButton, SegmentedControl } from '../../primitives';
import { useData, useUi } from '../../context';

const SCOPES: { key: SearchScope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'archived', label: 'Archived' },
];

/** Which slice to search, and whose. Reset clears the tag filter too — the three
 *  narrow the same list, so one control puts all of it back. */
export function ScopeFilterBar({ filtersActive, onReset }: { filtersActive: boolean; onReset: () => void }) {
  // Search reaches into the archive, so it offers *every* client — an archived
  // one still has history worth finding.
  const { allClients, colorOf } = useData();
  const { searchScope, setSearchScope, searchClient, setSearchClient } = useUi();
  return (
    <div className="flex flex-wrap items-center gap-2 mt-[14px] mb-[14px]">
      <SegmentedControl
        aria-label="Search scope"
        options={SCOPES.map((s) => ({ value: s.key, label: s.label }))}
        value={searchScope}
        onChange={setSearchScope}
      />

      <span className="w-px h-[20px] bg-neutral-400 mx-1" />

      <Chip selected={searchClient === ''} onClick={() => setSearchClient('')}>
        All clients
      </Chip>
      {allClients.map((c) => {
        const active = searchClient === c.id;
        return (
          <Chip
            key={c.id}
            selected={active}
            onClick={() => setSearchClient(c.id)}
            title={c.archived ? `${c.name} (archived)` : c.name}
            className={c.archived && !active ? 'opacity-60' : undefined}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(c.id) }} />
            {c.name}
          </Chip>
        );
      })}

      {filtersActive && (
        <LinkButton onClick={onReset} className="px-1">
          Reset
        </LinkButton>
      )}
    </div>
  );
}
