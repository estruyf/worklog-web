// Warns before the tab is closed or reloaded while edits haven't reached GitHub.
// The store also mirrors those edits to IndexedDB (see data/pendingStore), so this
// is a safety prompt, not the only line of defense — a user who leaves anyway can
// recover on the next open.

import { useEffect } from 'react';
import { worklogStore } from '../../data/worklogStore';

export function useUnsavedGuard(): void {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (worklogStore.hasPending()) {
        // The message is ignored by modern browsers, but preventDefault +
        // returnValue is still required to trigger the native confirmation.
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}
