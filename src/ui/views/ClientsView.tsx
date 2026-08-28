import React, { useMemo } from 'react';
import type { WorklogRow } from '../model';
import { PencilIcon } from 'lucide-react';
import { TaskListToolbar, TaskTable } from '../components';
import { Badge, Button, Card, EmptyState, LinkButton, SectionLabel, ViewHeader } from '../primitives';
import { useData, useUi } from '../context';
import { useTaskListFilter } from '../hooks';
import { clientIdOf, fmtLong, isDone, topLevelTasks } from '../utils';
import { ClientInfoCard, ClientList, CompletedTaskList, MobileClientDropdown } from './clients-view';

/** Derives the selected client's open rows, done list, counts and last-worked label. */
function useClientsData() {
  const { tasks, worklog, clients, allClients, archivedClients, today, colorOf, openRowsFor } = useData();
  const { selectedClient } = useUi();

  const openTasks = useMemo(() => tasks.filter((t) => !isDone(t)), [tasks]);
  // Selection resolves against every client: an archived one is still openable
  // from the archived list below, it just isn't offered by default.
  const selectedClientObj = useMemo(() => allClients.find((c) => c.id === selectedClient), [allClients, selectedClient]);
  const clientOpenCounts = useMemo(
    () => Object.fromEntries(allClients.map((c) => [c.id, openTasks.filter((t) => clientIdOf(t) === c.id).length])),
    [allClients, openTasks],
  );
  const scOpen = useMemo(() => tasks.filter((t) => clientIdOf(t) === selectedClient && !isDone(t)), [tasks, selectedClient]);
  // Keyed on the client: switching to another one starts from an unfiltered list
  // rather than making its tasks look absent.
  const openFilter = useTaskListFilter(scOpen, { label: 'open tasks', resetKey: selectedClient });
  const selectedOpenRows = useMemo<WorklogRow[]>(
    () => openRowsFor(openFilter.tasks, openFilter.expanded),
    [openRowsFor, openFilter.tasks, openFilter.expanded],
  );
  const selectedDone = useMemo(
    () => tasks.filter((t) => clientIdOf(t) === selectedClient && isDone(t)).sort((a, b) => (b.completed! > a.completed! ? 1 : -1)),
    [tasks, selectedClient],
  );
  const selectedLastWorked = useMemo(() => {
    const lastWorked = worklog
      .filter((w) => w.clientId === selectedClient)
      .map((w) => w.date)
      .sort()
      .pop();
    return lastWorked ? (lastWorked === today ? 'last worked today' : 'last worked ' + fmtLong(lastWorked)) : 'no time logged yet';
  }, [worklog, today, selectedClient]);

  return {
    clients,
    archivedClients,
    selectedColor: colorOf(selectedClient),
    selectedName: selectedClientObj?.name ?? '',
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    // Parent tasks only, like every other count in the lists: a subtask is part
    // of the task above it, not a second thing on this client's plate.
    selectedOpenCount: topLevelTasks(scOpen).length,
    openFilter,
    selectedDone,
    selectedLastWorked,
  };
}

export function ClientsView() {
  const { openClientEditor, setClientArchived } = useData();
  const {
    clients,
    archivedClients,
    selectedColor,
    selectedName,
    selectedClientObj,
    clientOpenCounts,
    selectedOpenRows,
    selectedOpenCount,
    selectedDone,
    selectedLastWorked,
    openFilter,
  } = useClientsData();
  const addClient = () => openClientEditor();
  const clientDescription = selectedClientObj?.description?.trim() ?? '';
  const clientLinks = selectedClientObj?.links ?? [];
  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <MobileClientDropdown
        clients={clients}
        archivedClients={archivedClients}
        selectedName={selectedName}
        clientOpenCounts={clientOpenCounts}
        onAdd={addClient}
      />
      <ClientList
        clients={clients}
        archivedClients={archivedClients}
        clientOpenCounts={clientOpenCounts}
        onAdd={addClient}
      />

      {/* The client's own column: which client you are on, and the two things you
          can do to it, stay in the band while its task lists scroll. Full width
          rather than the centred column the other views use — this pane is
          already narrowed by the two rails to its left. */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <ViewHeader className="flex items-center flex-wrap gap-[14px]">
          <span className="w-[11px] h-[11px] rounded-full" style={{ background: selectedColor }} />
          <h1 className="text-[24px] font-bold m-0">{selectedName}</h1>
          {selectedClientObj?.archived && (
            <Badge tone="outline" size="sm" title="Hidden from the pickers and lists; its history is untouched">
              Archived
            </Badge>
          )}
          <span className="text-body text-neutral-675">{selectedLastWorked}</span>
          {selectedClientObj && (
            <Button size="xs" onClick={() => openClientEditor(selectedClientObj)} title="Edit client" className="ml-1">
              <PencilIcon size={13} />
              Edit
            </Button>
          )}
          {selectedClientObj?.archived && (
            <Button size="xs" onClick={() => setClientArchived(selectedClientObj, false)} title="Bring this client back into the pickers and lists">
              Restore
            </Button>
          )}
        </ViewHeader>

        <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
          <ClientInfoCard description={clientDescription} links={clientLinks} />

          <SectionLabel className="mb-[14px]">Open tasks · {selectedOpenCount}</SectionLabel>
          <Card padding="list" className="mb-[38px]">
            {openFilter.toolbar && <TaskListToolbar {...openFilter.toolbar} />}
            <TaskTable rows={selectedOpenRows} sort={openFilter.sort}>
              {selectedOpenRows.length === 0 && (
                <EmptyState className="py-2 px-2.5">
                  {selectedOpenCount === 0 ? (
                    'No open tasks.'
                  ) : (
                    <>
                      No open tasks match these filters.{' '}
                      <LinkButton size="inherit" onClick={openFilter.reset} className="italic underline">
                        Reset
                      </LinkButton>
                    </>
                  )}
                </EmptyState>
              )}
            </TaskTable>
          </Card>

          <CompletedTaskList tasks={selectedDone} clientName={selectedName} />
        </div>
      </div>
    </div>
  );
}
