import React from 'react';
import { Button, Modal } from '../primitives';
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

  // `captureKeys`: while the dialog is up it owns the keyboard, so nothing behind
  // it reacts — not the shell's shortcuts, and not the task form's Esc, which
  // would otherwise navigate away underneath the question it just asked. Enter
  // isn't handled here; the confirm button is focused, so the browser activates
  // it natively.
  return (
    <Modal
      role="alertdialog"
      onClose={() => settle(false)}
      captureKeys
      layer="top"
      size="sm"
      offset="lg"
      title={request.title}
      titleSize="sm"
      describedBy={request.message ? 'worklog-confirm-message' : undefined}
    >
      {request.message && (
        <p id="worklog-confirm-message" className="text-body text-neutral-700 leading-[1.55] mt-[10px] mb-0">
          {request.message}
        </p>
      )}
      <div className="flex justify-end gap-[10px] mt-[26px]">
        {!request.acknowledge && (
          <Button variant="neutral" size="lg" onClick={() => settle(false)}>
            {request.cancelLabel ?? 'Cancel'}
          </Button>
        )}
        <Button autoFocus variant={danger ? 'dangerSolid' : 'primary'} size="lg" onClick={() => settle(true)}>
          {request.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Modal>
  );
}
