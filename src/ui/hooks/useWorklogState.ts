// Reads the live app state from the store and owns the transient toast. State
// arrives through `useSyncExternalStore` (no ready handshake); sync-status and
// action-failure notifications arrive on the store's `onToast` channel.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { worklogStore, type ToastMessage } from '../../data/worklogStore';

export function useWorklogState() {
  const { data, loading, gitPending, pendingCount, offline, syncError, lastSyncedAt } = useSyncExternalStore(
    worklogStore.subscribe,
    worklogStore.getSnapshot,
    worklogStore.getSnapshot,
  );
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => worklogStore.onToast(setToast), []);

  // Auto-dismiss transient toasts. An in-flight 'loading' toast stays until it's
  // superseded by the completion (or error) toast that the store emits next.
  useEffect(() => {
    if (!toast || toast.tone === 'loading') {
      return;
    }
    const id = setTimeout(() => setToast(null), toast.tone === 'error' ? 4000 : 2500);
    return () => clearTimeout(id);
  }, [toast]);

  return { snap: data, loading, toast, gitPending, pendingCount, offline, syncError, lastSyncedAt };
}
