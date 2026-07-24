// Reads the live app state from the store and owns the transient error toast.
// State arrives through `useSyncExternalStore` (no ready handshake); action
// failures arrive on the store's `onError` channel.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { worklogStore } from '../../data/worklogStore';

export function useWorklogState() {
  const { data, loading, gitPending } = useSyncExternalStore(
    worklogStore.subscribe,
    worklogStore.getSnapshot,
    worklogStore.getSnapshot,
  );
  const [error, setError] = useState('');

  useEffect(() => worklogStore.onError(setError), []);

  // Auto-dismiss the error toast after a few seconds.
  useEffect(() => {
    if (!error) {
      return;
    }
    const id = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(id);
  }, [error]);

  return { snap: data, loading, error, setError, gitPending };
}
