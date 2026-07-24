import React from 'react';
import type { ToastMessage } from '../../data/worklogStore';

const TONE_CLASS: Record<ToastMessage['tone'], string> = {
  loading: 'bg-white border-[#E5E7EB] text-[#3C4149]',
  info: 'bg-white border-[#E5E7EB] text-[#3C4149]',
  success: 'bg-[#ECFDF3] border-[#BBF7D0] text-[#15803D]',
  error: 'bg-[#FEF2F2] border-[#F0C9C9] text-[#DC2626]',
};

/** Spinning ring shown while a sync is in flight. */
function Spinner() {
  return <span className="w-[13px] h-[13px] shrink-0 rounded-full border-2 border-[#D0D7DE] border-t-[#2D6CDF] animate-spin" />;
}

/** Check glyph shown on a completed sync. */
function CheckIcon() {
  return (
    <svg className="shrink-0" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/** Transient notification pinned to the bottom of the shell: sync status + errors. */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) {
    return null;
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        'fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-[8px] border text-[13px] px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ' +
        TONE_CLASS[toast.tone]
      }
    >
      {toast.tone === 'loading' && <Spinner />}
      {toast.tone === 'success' && <CheckIcon />}
      {toast.message}
    </div>
  );
}
