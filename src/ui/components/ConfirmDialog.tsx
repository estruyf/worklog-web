import React, { useEffect } from 'react';
import { useUi } from '../context';
import type { ConfirmRequest } from '../hooks/useConfirmDialog';

/** The app's confirmation / notice dialog — what window.confirm and window.alert
 *  used to do, in the app's own styling and without blocking the page. Driven by
 *  the pending question in UI state (see useConfirmDialog); renders nothing when
 *  there isn't one. Mounted by the shell, so any action can raise it. */
export function ConfirmDialog() {
  const { confirm } = useUi();
  if (!confirm.request) {
    return null;
  }
  // Split so the dialog body mounts with a question in hand: its focus and key
  // handling are mount-time concerns, not conditionals inside a hook.
  return <Dialog request={confirm.request} settle={confirm.settle} />;
}

function Dialog({ request, settle }: { request: ConfirmRequest; settle: (confirmed: boolean) => void }) {
  const danger = request.tone === 'danger';

  // While the dialog is up it owns the keyboard: keydowns are stopped in the
  // capture phase so nothing behind it reacts — not the shell's shortcuts, and
  // not the task form's Esc, which would otherwise navigate away underneath the
  // question it just asked. Enter isn't handled here; the confirm button is
  // focused, so the browser activates it natively.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [settle]);

  return (
    <div
      onClick={() => settle(false)}
      className="fixed inset-0 z-[60] bg-overlay flex items-start justify-center pt-[16vh] px-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="worklog-confirm-title"
        aria-describedby={request.message ? 'worklog-confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[14px] w-[440px] max-w-full px-7 pt-[26px] pb-[22px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
      >
        <h2 id="worklog-confirm-title" className="text-[17px] font-bold m-0 leading-[1.35]">
          {request.title}
        </h2>
        {request.message && (
          <p id="worklog-confirm-message" className="text-[14px] text-neutral-700 leading-[1.55] mt-[10px] mb-0">
            {request.message}
          </p>
        )}
        <div className="flex justify-end gap-[10px] mt-[26px]">
          {!request.acknowledge && (
            <button
              onClick={() => settle(false)}
              className="px-5 py-[10px] border border-neutral-400 rounded-[9px] bg-neutral-250 text-[14px] font-semibold cursor-pointer hover:bg-neutral-300"
            >
              {request.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            autoFocus
            onClick={() => settle(true)}
            className={
              'px-[22px] py-[10px] rounded-[9px] text-[14px] font-semibold border cursor-pointer ' +
              (danger
                ? 'border-danger-675 bg-danger-675 text-white hover:bg-danger-700 hover:border-danger-700'
                : 'border-brand-500 bg-brand-450 text-brand-800 hover:bg-brand-475')
            }
          >
            {request.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
