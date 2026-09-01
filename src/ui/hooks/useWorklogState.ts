// Reads the live app state from the store and owns the transient toast. State
// arrives through `useSyncExternalStore` (no ready handshake); sync-status and
// action-failure notifications arrive on the store's `onToast` channel.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { UNDO_WINDOW_MS, worklogStore, type ToastMessage } from '../../data/worklogStore';

export function useWorklogState() {
  const { data, loading, gitPending, pendingCount, offline, syncError, lastSyncedAt } = useSyncExternalStore(
    worklogStore.subscribe,
    worklogStore.getSnapshot,
    worklogStore.getSnapshot,
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => worklogStore.onToast(setToast), []);

  // Auto-dismiss transient toasts. An in-flight 'loading' toast stays until it's
  // superseded by the completion (or error) toast that the store emits next. One
  // carrying an action (Undo) lingers for the whole undo window: it is an offer,
  // not just a status, and 2.5s is not enough to read it and take it up. The store
  // holds its auto-sync back for exactly as long, so the offer is good until it goes.
  useEffect(() => {
    if (!toast || toast.tone === 'loading') {
      return;
    }
    const ms = toast.action ? UNDO_WINDOW_MS : toast.tone === 'error' ? 4000 : 2500;
    const id = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(id);
  }, [toast]);

  const dismissToast = useCallback(() => setToast(null), []);

  return { snap: data, loading, toast, dismissToast, gitPending, pendingCount, offline, syncError, lastSyncedAt };
}
