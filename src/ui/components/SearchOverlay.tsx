import React, { useEffect, useRef, useState } from 'react';
import { ExternalLinkIcon, SearchIcon } from 'lucide-react';
import { Badge, Chip, EmptyState, Input, LinkButton, Modal, SectionLabel, SegmentedControl } from '../primitives';
import { useData, useUi } from '../context';
import { useSearchData } from '../hooks';
import { Kbd } from './Kbd';

const SCOPES: { key: 'all' | 'open' | 'archived'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'archived', label: 'Archived' },
];

/** Command-palette style search overlay, layered on top of the active view.
 * Opened via the nav Search button or ⌘F/⌘S; closed via Esc, the backdrop, or
 * opening a hit. Keyboard nav (↑/↓/↵) is driven by the shell while this is open. */
/** How many tag chips show before the row collapses behind "+n more". */
const TAG_CHIP_LIMIT = 12;

export function SearchOverlay() {
  // Search reaches into the archive, so it offers *every* client — an archived
  // one still has history worth finding.
  const { allClients, colorOf, allTags, toggleTagFilter, clearTagFilter } = useData();
  const { search, setSearch, searchScope, setSearchScope, searchClient, setSearchClient, tagFilter, searchSel, setSearchOpen } = useUi();
  const { q, filtered, groups, count, openCount, archivedCount } = useSearchData();
  const [allTagsShown, setAllTagsShown] = useState(false);

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

  // Selected tags stay visible even when the row is collapsed, so a filter can
  // always be switched off where it was switched on.
  const visibleTags = allTagsShown
    ? allTags
    : allTags.filter((t, i) => i < TAG_CHIP_LIMIT || tagFilter.includes(t.tag));
  const hiddenTagCount = allTags.length - visibleTags.length;

  let flatIndex = 0;

  return (
    // No heading of its own — the search field is the dialog, so `label` names it.
    // `padding="none"`: the results scroll under a fixed filter block, which one
    // padding box around the lot would break.
    <Modal onClose={close} label="Search tasks" size="lg" offset="sm" padding="none" className="max-h-[78vh] flex flex-col">
      {/* Search input */}
      <div className="px-5 pt-5">
        {/* The clear `×` is the last thing in the row, as it is in the archive
            filter — so the two search fields end the same way. */}
        <Input
          id="worklog-search-input"
          size="lg"
          variant="accent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus={true}
          clearable
          onClear={() => setSearch('')}
          leading={<SearchIcon size={16} className="shrink-0 text-neutral-650" />}
          trailing={
            <>
              {filtered && (
                <span className="shrink-0 text-control text-neutral-650">
                  {count} {count === 1 ? 'result' : 'results'}
                </span>
              )}
              <button className="shrink-0 text-muted hover:text-fg cursor-pointer" onClick={close} aria-label="Close search" title="Close (Esc)">
                <Kbd>Esc</Kbd>
              </button>
            </>
          }
          aria-label="Search tasks"
          placeholder="Search tasks by title, link, description..."
          inputClassName="text-input-fg"
        />

        {/* Scope segmented control + client chips + reset */}
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
            <LinkButton onClick={resetFilters} className="px-1">
              Reset
            </LinkButton>
          )}
        </div>

        {/* Tag filter — a filter in its own right: with tags picked and the
            query empty, the results below are everything carrying them. */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-[14px]">
            <SectionLabel className="mr-[2px]">Tags</SectionLabel>
            {visibleTags.map(({ tag, count: n }) => {
              const active = tagFilter.includes(tag);
              return (
                <Chip
                  key={tag}
                  selected={active}
                  onClick={() => toggleTagFilter(tag)}
                  title={active ? `Stop filtering by "${tag}"` : `Filter by "${tag}"`}
                >
                  {tag}
                  <span className={'text-eyebrow tabular-nums ' + (active ? 'text-brand-650' : 'text-neutral-625')}>{n}</span>
                </Chip>
              );
            })}
            {hiddenTagCount > 0 && (
              <LinkButton onClick={() => setAllTagsShown(true)} className="px-1">
                +{hiddenTagCount} more
              </LinkButton>
            )}
            {tagFilter.length > 0 && (
              <LinkButton onClick={clearTagFilter} className="px-1">
                Clear tags
              </LinkButton>
            )}
          </div>
        )}
      </div>

      {/* Results (scrollable) */}
      <div className="flex-1 overflow-auto px-5 pb-5 border-t border-neutral-325">
        {/* Idle state */}
        {!filtered && (
          <div className="mt-5 rounded-card border border-dashed border-neutral-500 bg-neutral-50 px-6 py-7 text-center">
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-[26px] font-bold text-neutral-825 leading-none">{openCount}</div>
                <div className="text-meta text-neutral-675 mt-[6px]">open</div>
              </div>
              <span className="w-px h-[34px] bg-neutral-400" />
              <div>
                <div className="text-[26px] font-bold text-neutral-825 leading-none">{archivedCount}</div>
                <div className="text-meta text-neutral-675 mt-[6px]">archived</div>
              </div>
            </div>
            <div className="flex items-center justify-center flex-wrap gap-[6px] text-meta text-neutral-650 mt-6">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>to move</span>
              <Kbd>↵</Kbd>
              <span>to open</span>
              <Kbd>Esc</Kbd>
              <span>to close</span>
            </div>
          </div>
        )}

        {filtered && count === 0 && (
          <EmptyState className="mt-5">
            No tasks match
            {q !== '' && <> "{search}"</>}
            {q !== '' && tagFilter.length > 0 && ' with'}
            {tagFilter.length > 0 && ` ${tagFilter.length === 1 ? 'the tag' : 'the tags'} ${tagFilter.join(', ')}`}.
          </EmptyState>
        )}

        {/* Grouped results */}
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
                    <div
                      key={ri}
                      ref={selected ? selRef : undefined}
                      onClick={() => {
                        r.onEdit();
                        close();
                      }}
                      title="Open task"
                      className={
                        'flex items-start gap-[11px] py-[9px] px-[10px] rounded-control-md cursor-pointer border ' +
                        (selected ? 'bg-brand-75 border-brand-425' : 'border-transparent hover:bg-neutral-125')
                      }
                    >
                      <span className="w-16 shrink-0 mt-[3px] text-status font-bold tracking-status" style={{ color: r.statusColor }}>
                        {r.statusLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-[8px] flex-wrap">
                          <span className="text-row">
                            {r.hasMid ? (
                              <>
                                {r.pre}
                                <mark className="bg-brand-225 text-inherit rounded-[2px] px-[1px]">{r.mid}</mark>
                                {r.post}
                              </>
                            ) : (
                              r.title
                            )}
                          </span>
                          {r.matchBadge && (
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.04em] text-neutral-675 bg-neutral-250 border border-neutral-400 rounded-chip px-[5px] py-[1px]">
                              {r.matchBadge}
                            </span>
                          )}
                          {r.tags.map((tag) => {
                            const active = tagFilter.includes(tag);
                            return (
                              <Chip
                                key={tag}
                                variant="tag"
                                selected={active}
                                onClick={(e) => {
                                  // The row itself opens the task; a tag narrows the list instead.
                                  e.stopPropagation();
                                  toggleTagFilter(tag);
                                }}
                                title={active ? `Stop filtering by "${tag}"` : `Filter by "${tag}"`}
                              >
                                {tag}
                              </Chip>
                            );
                          })}
                        </div>
                        {r.snippet && <div className="text-chip text-neutral-650 mt-[3px] truncate">{r.snippet}</div>}
                      </div>
                      {r.hasLink && (
                        <a
                          href={r.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="text-neutral-675 leading-[0] mt-[3px] hover:text-info"
                          title={r.link}
                        >
                          <ExternalLinkIcon size={14} />
                        </a>
                      )}
                    </div>
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
