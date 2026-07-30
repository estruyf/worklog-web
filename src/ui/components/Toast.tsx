import React from 'react';
import { CheckIcon } from 'lucide-react';
import type { ToastMessage } from '../../data/worklogStore';

const TONE_CLASS: Record<ToastMessage['tone'], string> = {
  loading: 'bg-white border-neutral-400 text-neutral-750',
  info: 'bg-white border-neutral-400 text-neutral-750',
  success: 'bg-success-75 border-success-150 text-success-600',
  error: 'bg-danger-75 border-danger-225 text-danger-675',
};

/** Spinning ring shown while a sync is in flight. */
function Spinner() {
  return <span className="w-[13px] h-[13px] shrink-0 rounded-full border-2 border-neutral-525 border-t-info animate-spin" />;
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
        'fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-control-md border text-control px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ' +
        TONE_CLASS[toast.tone]
      }
    >
      {toast.tone === 'loading' && <Spinner />}
      {toast.tone === 'success' && <CheckIcon size={14} className="shrink-0" />}
      {toast.message}
    </div>
  );
}
