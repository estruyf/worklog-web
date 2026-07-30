import React from 'react';
import { navigateToView } from '../../router';
import { useData, useUi } from '../../context';

/** The logo itself. Decorative — the word "Worklog" beside it is the name. */
export function BrandGlyph() {
  return <img src="/worklog-logo-outline.svg" alt="" width="20" height="20" className="rounded-chip" />;
}

/** Logo + wordmark, which is also the way back to today. Picking it snaps the
 *  Day view back to today: a date left over from browsing the calendar isn't
 *  what "Worklog" means when you deliberately click it. */
export function BrandMark({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { today } = useData();
  const { setSelectedDate } = useUi();
  return (
    <button
      onClick={() => {
        if (today) {
          setSelectedDate(today);
        }
        navigateToView('day');
        onNavigate?.();
      }}
      className={'flex items-center gap-2 font-bold text-[15px] cursor-pointer bg-transparent border-none text-left ' + (className ?? '')}
      title="Go to Day view"
    >
      <BrandGlyph />
      Worklog
    </button>
  );
}
