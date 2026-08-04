import React, { useEffect, useRef } from 'react';
import { Badge, EmptyState, Modal } from '../primitives';
import { useData, useUi } from '../context';
import { useSearchData } from '../hooks';
import { ScopeFilterBar, SearchField, SearchIdleState, SearchResultRow, TagFilterBar } from './search-overlay';

/** Command-palette style search overlay, layered on top of the active view.
 * Opened via the nav Search button or ⌘F/⌘S; closed via Esc, the backdrop, or
 * opening a hit. Keyboard nav (↑/↓/↵) is driven by the shell while this is open. */
export function SearchOverlay() {
  const { clearTagFilter } = useData();
  const { search, setSearch, searchScope, setSearchScope, searchClient, setSearchClient, tagFilter, searchSel, setSearchOpen } = useUi();
  const { q, filtered, groups, count, openCount, archivedCount, noteCount } = useSearchData();

  const close = () => setSearchOpen(false);

  // Keep the keyboard-selected row scrolled into view as the cursor moves.
  const selRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' });
  }, [searchSel]);

  const filtersActive = searchScope !== 'all' || searchClient !== '' || tagFilter.length > 0;
  const resetFilters = () => {
    setSearchScope('all');
    setSearchClient('');
    clearTagFilter();
  };

  // The rows are grouped by client but the cursor runs through all of them, so
  // the flat index has to be counted across the groups as they render.
  let flatIndex = 0;

  return (
    // No heading of its own — the search field is the dialog, so `label` names it.
    // `padding="none"`: the results scroll under a fixed filter block, which one
    // padding box around the lot would break.
    <Modal onClose={close} label="Search" size="lg" offset="sm" padding="none" className="max-h-[78vh] flex flex-col">
      <div className="px-5 pt-5">
        <SearchField value={search} onChange={setSearch} onClose={close} count={filtered ? count : undefined} />
        <ScopeFilterBar filtersActive={filtersActive} onReset={resetFilters} />
        <TagFilterBar />
      </div>

      {/* Results (scrollable) */}
      <div className="flex-1 overflow-auto px-5 pb-5 border-t border-neutral-325">
        {!filtered && <SearchIdleState openCount={openCount} archivedCount={archivedCount} noteCount={noteCount} />}

        {filtered && count === 0 && (
          <EmptyState className="mt-5">
            Nothing matches
            {q !== '' && <> "{search}"</>}
            {q !== '' && tagFilter.length > 0 && ' with'}
            {tagFilter.length > 0 && ` ${tagFilter.length === 1 ? 'the tag' : 'the tags'} ${tagFilter.join(', ')}`}.
          </EmptyState>
        )}

        <div className="mt-4">
          {groups.map((g, gi) => (
            <div key={gi} className="mb-6">
              <div className="flex items-center gap-[8px] mb-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
                <span className="text-chip font-semibold text-neutral-750">{g.name}</span>
                <Badge size="xs">{g.count}</Badge>
              </div>
              <div>
                {g.rows.map((r, ri) => {
                  const i = flatIndex++;
                  const selected = i === searchSel;
                  return (
                    <SearchResultRow
                      key={ri}
                      ref={selected ? selRef : undefined}
                      row={r}
                      selected={selected}
                      onOpen={() => {
                        r.onEdit();
                        close();
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
