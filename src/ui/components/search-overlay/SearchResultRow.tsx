import React from 'react';
import type { SearchResult } from '../../model';
import { ExternalLinkIcon } from 'lucide-react';
import { Chip } from '../../primitives';
import { useData, useUi } from '../../context';
import { LIST_COLOR, NOTE_COLOR } from '../../utils';

export interface SearchResultRowProps {
  row: SearchResult;
  /** The keyboard cursor is on this row. */
  selected: boolean;
  onOpen: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

/** One hit: status, title with the match highlighted, its tags, and the link.
 *
 *  A `div` rather than a `button`, unlike the completed-task rows: this one
 *  contains its own controls — the tag chips and the external link — and a
 *  button cannot hold buttons. The palette's keyboard path is the shell's
 *  ↑/↓/↵ over the same ordered list, not Tab through the rows. */
export function SearchResultRow({ row, selected, onOpen, ref }: SearchResultRowProps) {
  const { toggleTagFilter } = useData();
  const { tagFilter } = useUi();
  const note = row.kind === 'note';
  const list = row.kind === 'list';
  return (
    <div
      ref={ref}
      onClick={onOpen}
      title={note ? 'Open day' : list ? 'Open list' : 'Open task'}
      className={
        'flex items-start gap-[11px] py-[9px] px-[10px] rounded-control-md cursor-pointer border ' +
        (selected ? 'bg-brand-75 border-brand-425' : 'border-transparent hover:bg-neutral-125')
      }
    >
      {/* The column stays even for a note or a list item, neither of which has a
        * status: it keeps every row's title on the same left edge, and the one
        * word in it says why this hit isn't a task. */}
      <span
        className="w-16 shrink-0 mt-[3px] text-status font-bold tracking-status"
        style={{ color: note ? NOTE_COLOR : list ? LIST_COLOR : row.statusColor }}
      >
        {note ? 'note' : list ? 'list' : row.statusLabel}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[8px] flex-wrap">
          <span className="text-row">
            {row.hasMid ? (
              <>
                {row.pre}
                <mark className="bg-brand-225 text-inherit rounded-[2px] px-[1px]">{row.mid}</mark>
                {row.post}
              </>
            ) : (
              row.title
            )}
          </span>
          {row.matchBadge && (
            <span className="shrink-0 text-[10px] uppercase tracking-[0.04em] text-neutral-675 bg-neutral-250 border border-neutral-400 rounded-chip px-[5px] py-[1px]">
              {row.matchBadge}
            </span>
          )}
          {row.tags.map((tag) => {
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
        {row.snippet && <div className="text-chip text-neutral-650 mt-[3px] truncate">{row.snippet}</div>}
      </div>
      {row.hasLink && (
        <a
          href={row.link}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="text-neutral-675 leading-[0] mt-[3px] hover:text-info"
          title={row.link}
        >
          <ExternalLinkIcon size={14} />
        </a>
      )}
    </div>
  );
}
