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

/** Transient notification pinned to the bottom of the shell: sync status + errors.
 *
 *  Sits above every overlay in the app — the task panel (z-40), the sidebar drawer
 *  and dialogs (z-50/60). A sync finishing or failing while a task is open is
 *  exactly when the state matters, and the layer below it covers the whole
 *  viewport, so anything lower is simply never seen. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss?: () => void }) {
  if (!toast) {
    return null;
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-70 flex items-center gap-2 max-w-[min(480px,90vw)] rounded-control-md border text-control px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ' +
        TONE_CLASS[toast.tone]
      }
    >
      {toast.tone === 'loading' && <Spinner />}
      {toast.tone === 'success' && <CheckIcon size={14} className="shrink-0" />}
      <span className="min-w-0">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            // Dismiss first, so the offer can't be taken up twice while the
            // (async) undo it triggers is still in flight.
            onDismiss?.();
            toast.action?.run();
          }}
          className="shrink-0 ml-1 bg-transparent border-none p-0 cursor-pointer font-semibold underline underline-offset-2 text-inherit hover:opacity-75"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
