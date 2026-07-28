// The single-task page at /app/task/<id>. Reuses the full provider + TaskDetailPanel
// (in `routed` mode, which renders a breadcrumb instead of the in-app Back button),
// pinned to one task and without the dashboard chrome. Edit / new-client still work
// because their modals mount here too. A shareable URL with working browser
// back/forward; the breadcrumb navigates back to the dashboard or the parent task.
//
// Nothing pins the detail view here: on a task route the router reports the
// route's own task as the open one (see useDetailId), so the panel follows the URL.

import { useData, useUi, WorklogProvider } from './context';
import { ClientFormModal, Toast, TaskDetailPanel, TaskFormModal } from './components';
import { navigateToDashboard } from './router';

function TaskPageShell({ taskId }: { taskId: string }) {
  const { snap, toast } = useData();
  const { modalOpen, clientModalOpen } = useUi();

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

      {modalOpen && <TaskFormModal />}
      {clientModalOpen && <ClientFormModal />}

      <Toast toast={toast} />
    </div>
  );
}

export function TaskPage({ taskId }: { taskId: string }) {
  return (
    <WorklogProvider>
      <TaskPageShell taskId={taskId} />
    </WorklogProvider>
  );
}
