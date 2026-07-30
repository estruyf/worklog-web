import React, { useMemo } from 'react';
import type { WorklogRow } from '../model';
import { PencilIcon } from 'lucide-react';
import { WorklogTaskRow } from '../components';
import { Badge, Button, Card, EmptyState, SectionLabel } from '../primitives';
import { useData, useUi } from '../context';
import { clientIdOf, fmtLong, isDone } from '../utils';
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
  const selectedOpenRows = useMemo<WorklogRow[]>(() => openRowsFor(scOpen), [openRowsFor, scOpen]);
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
    selectedOpenCount: scOpen.length,
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
  } = useClientsData();
  const addClient = () => openClientEditor();
  const clientDescription = selectedClientObj?.description?.trim() ?? '';
  const clientLinks = selectedClientObj?.links ?? [];
  const hasClientInfo = !!clientDescription || clientLinks.length > 0;
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

      <div className="flex-1 overflow-auto px-5 py-6 md:px-9 md:py-[30px]">
        <div className={'flex items-center flex-wrap gap-[14px] ' + (hasClientInfo ? 'mb-4' : 'mb-7')}>
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
        </div>

        <ClientInfoCard description={clientDescription} links={clientLinks} />

        <SectionLabel className="mb-[14px]">Open tasks · {selectedOpenCount}</SectionLabel>
        <Card padding="list" className="mb-[38px]">
          {selectedOpenRows.map((r) => <WorklogTaskRow key={r.id} row={r} />)}
          {selectedOpenCount === 0 && <EmptyState className="py-2 px-2.5">No open tasks.</EmptyState>}
        </Card>

        <CompletedTaskList tasks={selectedDone} clientName={selectedName} />
      </div>
    </div>
  );
}
