import React from 'react';

export interface LegendEntry {
  id: string;
  color: string;
  label: string;
}

/** Decodes the phone-sized cells, which have room for colour dots but not names.
 *  Hidden from `md` up, where the cells say who they mean. */
export function Legend({ entries }: { entries: LegendEntry[] }) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex md:hidden flex-wrap gap-x-4 gap-y-2 mt-5">
      {entries.map((e) => (
        <span key={e.id} className="flex items-center gap-[6px]">
          <span className="w-[11px] h-[11px] rounded-full shrink-0" style={{ background: e.color }} />
          <span className="text-meta text-neutral-750">{e.label}</span>
        </span>
      ))}
    </div>
  );
}
