import React from 'react';

/** One headline number for the month. A filled tile rather than a `Card`: these
 *  sit above the tables and read as the summary *of* them, which a second
 *  bordered box in the same column would not. */
export function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-neutral-225 rounded-[11px] px-5 py-[18px]">
      <div className="text-control text-neutral-675 mb-2">{label}</div>
      <div className="text-[28px] font-bold">{value}</div>
    </div>
  );
}
