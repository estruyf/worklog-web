// Standalone editor tab for a single task (see views/taskWindow.ts on the host).
// Reuses the full provider + TaskDetailPanel, just pinned to one task and without
// the dashboard chrome. Edit/new-client still work because their modals mount here
// too. The host keeps the tab title in sync and closes it if the task is deleted.

import React from 'react';
import { useData, useUi, WorklogProvider } from './context';
import { ClientFormModal, ErrorToast, TaskDetailPanel, TaskFormModal } from './components';

function TaskWindowShell({ taskId }: { taskId: string }) {
  const { snap, error } = useData();
  const { setDetailId, modalOpen, clientModalOpen } = useUi();

  // Pin the detail view to this task once the app mounts.
  React.useEffect(() => {
    setDetailId(taskId);
  }, [taskId, setDetailId]);

  if (!snap) {
    return <div className="min-h-screen bg-white" />;
  }

  const exists = snap.tasks.some((t) => t.id === taskId);

  return (
    <div className="min-h-screen bg-white text-[#1F2328] antialiased" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <style>{`::selection{background:#FBEFC0}`}</style>

      {exists ? (
        <TaskDetailPanel windowMode />
      ) : (
        <div className="flex min-h-screen items-center justify-center text-[14px] text-[#6E7781]">This task no longer exists.</div>
      )}

      {modalOpen && <TaskFormModal />}
      {clientModalOpen && <ClientFormModal />}

      <ErrorToast message={error} />
    </div>
  );
}

export function TaskWindow({ taskId }: { taskId: string }) {
  return (
    <WorklogProvider>
      <TaskWindowShell taskId={taskId} />
    </WorklogProvider>
  );
}
