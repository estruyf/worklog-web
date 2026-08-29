import React from 'react';
import { Kbd } from '../Kbd';

export interface SearchIdleStateProps {
  openCount: number;
  archivedCount: number;
  noteCount: number;
  listCount: number;
}

/** What the palette shows before anything is typed: how much there is to search,
 *  and the three keys that drive it.
 *
 *  Every corpus the palette reaches gets a tile. This panel is the only place
 *  that tells anyone what ⌘K covers, so a corpus searched silently is a corpus
 *  nobody thinks to search. */
export function SearchIdleState({ openCount, archivedCount, noteCount, listCount }: SearchIdleStateProps) {
  return (
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
        <span className="w-px h-[34px] bg-neutral-400" />
        <div>
          <div className="text-[26px] font-bold text-neutral-825 leading-none">{noteCount}</div>
          <div className="text-meta text-neutral-675 mt-[6px]">{noteCount === 1 ? 'day note' : 'day notes'}</div>
        </div>
        {/* Absent rather than zero when Lists is switched off: the palette isn't
            searching them, so a tile would be advertising a corpus that has no
            hits to give. */}
        {listCount > 0 && (
          <>
            <span className="w-px h-[34px] bg-neutral-400" />
            <div>
              <div className="text-[26px] font-bold text-neutral-825 leading-none">{listCount}</div>
              <div className="text-meta text-neutral-675 mt-[6px]">{listCount === 1 ? 'list' : 'lists'}</div>
            </div>
          </>
        )}
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
  );
}
