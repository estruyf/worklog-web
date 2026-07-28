import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { useData, useUi } from '../context';
import { useSearchData } from '../hooks';

/** A small keyboard-key hint chip, e.g. ⌘F or ↵. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-[5px] border border-neutral-425 bg-neutral-200 text-neutral-700 text-[11px] font-medium leading-none shadow-[0_1px_0_var(--color-neutral-425)]">
      {children}
    </kbd>
  );
}

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
    <div onClick={close} className="fixed inset-0 bg-overlay flex items-start justify-center pt-[10vh] z-50">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[14px] w-[760px] max-w-[92vw] max-h-[78vh] flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        {/* Search input */}
        <div className="px-5 pt-5">
          <div className="flex items-center gap-[10px] px-[14px] py-[10px] border border-brand-500 rounded-[9px] shadow-[0_0_0_3px_var(--color-brand-225)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#8A9099" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              id="worklog-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus={true}
              className="flex-1 bg-transparent text-input-fg outline-none focus-visible:outline-none!"
              placeholder="Search tasks by title, link, description..."
            />
            {filtered && (
              <span className="shrink-0 text-[13px] text-neutral-650">
                {count} {count === 1 ? 'result' : 'results'}
              </span>
            )}
            {search && (
              <button className="text-muted hover:text-fg cursor-pointer" onClick={() => setSearch('')} aria-label="Clear">
                <Icon name="close" />
              </button>
            )}
            <button className="text-muted hover:text-fg cursor-pointer" onClick={close} aria-label="Close search" title="Close (Esc)">
              <Kbd>Esc</Kbd>
            </button>
          </div>

          {/* Scope segmented control + client chips + reset */}
          <div className="flex flex-wrap items-center gap-2 mt-[14px] mb-[14px]">
            <div className="inline-flex p-[2px] rounded-[8px] bg-neutral-250 border border-neutral-400">
              {SCOPES.map((s) => {
                const active = searchScope === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSearchScope(s.key)}
                    className={
                      'px-[11px] py-[5px] rounded-[6px] text-[12.5px] cursor-pointer ' +
                      (active ? 'bg-white text-neutral-825 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-neutral-675 font-medium')
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <span className="w-px h-[20px] bg-neutral-400 mx-1" />

            <button
              onClick={() => setSearchClient('')}
              className={
                'inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-full text-[12.5px] cursor-pointer border ' +
                (searchClient === '' ? 'border-brand-500 bg-brand-225 text-brand-650 font-semibold' : 'border-neutral-400 bg-white text-neutral-700')
              }
            >
              All clients
            </button>
            {allClients.map((c) => {
              const active = searchClient === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSearchClient(c.id)}
                  title={c.archived ? `${c.name} (archived)` : c.name}
                  className={
                    'inline-flex items-center gap-[6px] px-[10px] py-[5px] rounded-full text-[12.5px] cursor-pointer border ' +
                    (active ? 'border-brand-500 bg-brand-225 text-brand-650 font-semibold' : 'border-neutral-400 bg-white text-neutral-700') +
                    (c.archived && !active ? ' opacity-60' : '')
                  }
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(c.id) }} />
                  {c.name}
                </button>
              );
            })}

            {filtersActive && (
              <button onClick={resetFilters} className="text-[12.5px] text-info bg-none border-none cursor-pointer px-1">
                Reset
              </button>
            )}
          </div>

          {/* Tag filter — a filter in its own right: with tags picked and the
              query empty, the results below are everything carrying them. */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-[14px]">
              <span className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mr-[2px]">TAGS</span>
              {visibleTags.map(({ tag, count: n }) => {
                const active = tagFilter.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTagFilter(tag)}
                    title={active ? `Stop filtering by "${tag}"` : `Filter by "${tag}"`}
                    className={
                      'inline-flex items-center gap-[6px] px-[10px] py-[4px] rounded-full text-[12.5px] cursor-pointer border ' +
                      (active ? 'border-brand-500 bg-brand-225 text-brand-650 font-semibold' : 'border-neutral-400 bg-white text-neutral-700')
                    }
                  >
                    {tag}
                    <span className={'text-[11px] tabular-nums ' + (active ? 'text-brand-650' : 'text-neutral-625')}>{n}</span>
                  </button>
                );
              })}
              {hiddenTagCount > 0 && (
                <button onClick={() => setAllTagsShown(true)} className="text-[12.5px] text-info bg-none border-none cursor-pointer px-1">
                  +{hiddenTagCount} more
                </button>
              )}
              {tagFilter.length > 0 && (
                <button onClick={clearTagFilter} className="text-[12.5px] text-info bg-none border-none cursor-pointer px-1">
                  Clear tags
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results (scrollable) */}
        <div className="flex-1 overflow-auto px-5 pb-5 border-t border-neutral-325">
          {/* Idle state */}
          {!filtered && (
            <div className="mt-5 rounded-[14px] border border-dashed border-neutral-500 bg-neutral-50 px-6 py-7 text-center">
              <div className="flex items-center justify-center gap-8">
                <div>
                  <div className="text-[26px] font-bold text-neutral-825 leading-none">{openCount}</div>
                  <div className="text-[12px] text-neutral-675 mt-[6px]">open</div>
                </div>
                <span className="w-px h-[34px] bg-neutral-400" />
                <div>
                  <div className="text-[26px] font-bold text-neutral-825 leading-none">{archivedCount}</div>
                  <div className="text-[12px] text-neutral-675 mt-[6px]">archived</div>
                </div>
              </div>
              <div className="flex items-center justify-center flex-wrap gap-[6px] text-[12px] text-neutral-650 mt-6">
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
            <div className="text-[14px] text-neutral-625 italic mt-5">
              No tasks match
              {q !== '' && <> "{search}"</>}
              {q !== '' && tagFilter.length > 0 && ' with'}
              {tagFilter.length > 0 && ` ${tagFilter.length === 1 ? 'the tag' : 'the tags'} ${tagFilter.join(', ')}`}.
            </div>
          )}

          {/* Grouped results */}
          <div className="mt-4">
            {groups.map((g, gi) => (
              <div key={gi} className="mb-6">
                <div className="flex items-center gap-[8px] mb-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="text-[12.5px] font-semibold text-neutral-750">{g.name}</span>
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[6px] rounded-full bg-neutral-325 text-neutral-675 text-[11px] font-semibold">
                    {g.count}
                  </span>
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
                          'flex items-start gap-[11px] py-[9px] px-[10px] rounded-[8px] cursor-pointer border ' +
                          (selected ? 'bg-brand-75 border-brand-425' : 'border-transparent hover:bg-neutral-125')
                        }
                      >
                        <span className="w-16 shrink-0 mt-[3px] text-[10.5px] font-bold tracking-[0.05em]" style={{ color: r.statusColor }}>
                          {r.statusLabel}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[8px] flex-wrap">
                            <span className="text-[14.5px]">
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
                              <span className="shrink-0 text-[10px] uppercase tracking-[0.04em] text-neutral-675 bg-neutral-250 border border-neutral-400 rounded-[4px] px-[5px] py-[1px]">
                                {r.matchBadge}
                              </span>
                            )}
                            {r.tags.map((tag) => {
                              const active = tagFilter.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  onClick={(e) => {
                                    // The row itself opens the task; a tag narrows the list instead.
                                    e.stopPropagation();
                                    toggleTagFilter(tag);
                                  }}
                                  title={active ? `Stop filtering by "${tag}"` : `Filter by "${tag}"`}
                                  className={
                                    'shrink-0 text-[11px] rounded-full px-[8px] py-[1px] border cursor-pointer ' +
                                    (active
                                      ? 'border-brand-500 bg-brand-225 text-brand-650 font-semibold'
                                      : 'text-neutral-725 bg-neutral-250 border-neutral-400 hover:border-brand-500 hover:bg-brand-175 hover:text-brand-800')
                                  }
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                          {r.snippet && <div className="text-[12.5px] text-neutral-650 mt-[3px] truncate">{r.snippet}</div>}
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
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10M10 2h4v4M14 2L7.5 8.5" />
                            </svg>
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
      </div>
    </div>
  );
}
