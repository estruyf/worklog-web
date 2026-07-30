import React from 'react';
import { Kbd } from '../Kbd';

/** What the palette shows before anything is typed: how much there is to search,
 *  and the three keys that drive it. */
export function SearchIdleState({ openCount, archivedCount }: { openCount: number; archivedCount: number }) {
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
