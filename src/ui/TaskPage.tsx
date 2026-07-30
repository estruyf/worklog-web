// The single-task page at /app/task/<id>. Reuses TaskDetailPanel (in `routed` mode,
// which renders a breadcrumb instead of the in-app Back button), pinned to one task
// and without the dashboard chrome. Editing leaves for the form route; new-client
// still works because its modal mounts here too. A shareable URL with working
// browser back/forward; the breadcrumb navigates back to the dashboard or the
// parent task.
//
// Nothing pins the detail view here: on a task route the router reports the
// route's own task as the open one (see useDetailId), so the panel follows the URL.

import { useData, useUi } from './context';
import { ClientFormModal, ConfirmDialog, Toast, TaskDetailPanel } from './components';
import { navigateToDashboard } from './router';

export function TaskPage({ taskId }: { taskId: string }) {
  const { snap, toast } = useData();
  const { clientModalOpen } = useUi();

  if (!snap) {
    return <div className="min-h-screen bg-white" />;
  }

  const exists = snap.tasks.some((t) => t.id === taskId);

  return (
    <div className="min-h-screen bg-white text-neutral-825 antialiased" style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif" }}>
      <style>{`::selection{background:#FBEFC0}`}</style>

      {exists ? (
        <TaskDetailPanel routed />
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-[14px] text-neutral-675">
          This task no longer exists.
          <button onClick={navigateToDashboard} className="text-info hover:underline cursor-pointer bg-transparent border-none">
            ‹ Back to Worklog
          </button>
        </div>
      )}

      {clientModalOpen && <ClientFormModal />}

      {/* Deleting a task or a note asks here too, so the dialog mounts on this page. */}
      <ConfirmDialog />

      <Toast toast={toast} />
    </div>
  );
}
