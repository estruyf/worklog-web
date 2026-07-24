// Owns the live snapshot + transient error state and the host<->webview message
// wiring. Navigation and "open add task" messages are forwarded to the caller so
// the component can seed its own view/modal state.

import { useEffect, useState } from 'react';
import type { AppTab, HostMessage, Snapshot } from '../protocol';
import { onHostMessage, post } from '../vscodeApi';

interface HostHandlers {
  onNavigate: (tab: AppTab, clientId?: string) => void;
  onOpenAddTask: (clientId?: string) => void;
}

export function useSnapshot({ onNavigate, onOpenAddTask }: HostHandlers) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [gitPending, setGitPending] = useState(false);

  useEffect(() => {
    const off = onHostMessage((m: HostMessage) => {
      if (m.type === 'snapshot') {
        setSnap(m.snapshot);
      } else if (m.type === 'gitStatus') {
        setGitPending(m.pendingChanges);
      } else if (m.type === 'actionError') {
        setError(m.message);
      } else if (m.type === 'navigate') {
        onNavigate(m.tab, m.clientId);
      } else if (m.type === 'openAddTask') {
        onOpenAddTask(m.clientId);
      }
    });
    post({ type: 'ready' });
    return off;
    // Handlers are captured once on mount; callers pass stable setState-based
    // callbacks, matching the original single-subscription behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss the error toast after a few seconds.
  useEffect(() => {
    if (!error) {
      return;
    }
    const id = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(id);
  }, [error]);

  return { snap, error, setError, gitPending };
}
