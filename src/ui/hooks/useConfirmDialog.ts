// The in-app stand-in for window.confirm / window.alert. One pending question at
// a time lives here as UI state; <ConfirmDialog /> in the shell renders it and
// answers it. Callers `await ui.confirm.ask(...)` and read like the native call
// they replace — minus the browser chrome, and without freezing the page.

import { useCallback, useRef, useState } from "react";

export type ConfirmRequest = {
  /** The question itself, phrased so the buttons are the answer. */
  title: string;
  /** What happens if they go ahead — consequences, and what stays recoverable. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button red; for anything that destroys data. */
  tone?: "default" | "danger";
  /** A notice rather than a question: one dismiss button, no cancel. */
  acknowledge?: boolean;
};

type NotifyRequest = Pick<ConfirmRequest, "title" | "message" | "confirmLabel">;

export type ConfirmDialogApi = {
  /** The open question, or null when the dialog is down. */
  request: ConfirmRequest | null;
  /** Ask, and resolve to whether they confirmed. */
  ask: (request: ConfirmRequest) => Promise<boolean>;
  /** Tell them something, and resolve once it's dismissed. */
  notify: (request: NotifyRequest) => Promise<void>;
  /** Answer the open question and close the dialog. */
  settle: (confirmed: boolean) => void;
};

export function useConfirmDialog(): ConfirmDialogApi {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // The pending promise's resolver sits in a ref, not in state, so `ask` and
  // `settle` stay stable for the action callbacks that close over them.
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const ask = useCallback(
    (next: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        // A second question while one is open replaces it, and the one being
        // displaced answers "no" — whatever awaited it does nothing.
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setRequest(next);
      }),
    [],
  );

  const notify = useCallback(
    async (next: NotifyRequest) => {
      await ask({
        ...next,
        acknowledge: true,
        confirmLabel: next.confirmLabel ?? "Got it",
      });
    },
    [ask],
  );

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  return { request, ask, notify, settle };
}
