import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Client } from '../../model/types';
import type { WorklogRow } from '../model';
import { ChevronDownIcon, ExternalLinkIcon, PencilIcon } from 'lucide-react';
import { ClientListItem, CompletedTaskRow, DisclosureIcon, WorklogTaskRow } from '../components';
import { Badge, Button, Card, EmptyState, SectionLabel } from '../primitives';
import { useData, useUi } from '../context';
import { clientIdOf, fmtLong, fmtShort, isDone, renderMarkdown } from '../utils';

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

/** Mobile-only client picker: a dropdown showing each client's colour dot,
 * name and open-task count. Replaces the sidebar list on narrow screens. */
function MobileClientDropdown({
  clients,
  archivedClients,
  selectedClient,
  selectedName,
  clientOpenCounts,
  colorOf,
  onSelect,
  onAdd,
}: {
  clients: Client[];
  archivedClients: Client[];
  selectedClient: string;
  selectedName: string;
  clientOpenCounts: Record<string, number>;
  colorOf: (id: string) => string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="md:hidden relative shrink-0 border-b border-neutral-400 p-[14px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-[11px] border border-neutral-525 rounded-control-lg bg-white cursor-pointer"
      >
        <span className="flex items-center gap-[9px] min-w-0">
          <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: colorOf(selectedClient) }} />
          <span className="font-semibold text-[15px] truncate">{selectedName || 'Select client'}</span>
        </span>
        <ChevronDownIcon size={14} className={'shrink-0 text-neutral-700 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        // The 6px inset that used to be a margin on every row is the panel's own
        // padding, so the rows can be plain full-width buttons.
        <div className="absolute left-[14px] right-[14px] top-[calc(100%-4px)] z-20 max-h-[50vh] overflow-auto border border-neutral-400 rounded-[10px] bg-white shadow-lg p-[6px]">
          {clients.map((c) => (
            <ClientListItem
              key={c.id}
              name={c.name}
              color={colorOf(c.id)}
              count={clientOpenCounts[c.id] ?? 0}
              active={c.id === selectedClient}
              onClick={() => { onSelect(c.id); setOpen(false); }}
              className="w-full"
            />
          ))}
          {archivedClients.length > 0 && (
            <>
              <SectionLabel size="sm" className="mx-[6px] mt-[10px] mb-[6px] pt-[10px] border-t border-neutral-325">
                Archived · {archivedClients.length}
              </SectionLabel>
              {archivedClients.map((c) => (
                <ClientListItem
                  key={c.id}
                  name={c.name}
                  color={colorOf(c.id)}
                  count={clientOpenCounts[c.id] ?? 0}
                  active={c.id === selectedClient}
                  dimmed
                  onClick={() => { onSelect(c.id); setOpen(false); }}
                  className="w-full"
                />
              ))}
            </>
          )}
          <Button variant="dashed" size="md" onClick={() => { onAdd(); setOpen(false); }} className="w-full mt-[6px]">
            <span className="text-[15px] leading-none">+</span> Add client
          </Button>
        </div>
      )}
    </div>
  );
}

export function ClientsView() {
  const { statusMeta, openDetail, openClientEditor, colorOf, setClientArchived } = useData();
  const { selectedClient, setSelectedClient, showArchivedClients, setShowArchivedClients } = useUi();
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
  const clientDescription = selectedClientObj?.description?.trim() ?? '';
  const clientLinks = selectedClientObj?.links ?? [];
  const hasClientInfo = !!clientDescription || clientLinks.length > 0;
  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      <MobileClientDropdown
        clients={clients}
        archivedClients={archivedClients}
        selectedClient={selectedClient}
        selectedName={selectedName}
        clientOpenCounts={clientOpenCounts}
        colorOf={colorOf}
        onSelect={setSelectedClient}
        onAdd={() => openClientEditor()}
      />
      <div className="hidden md:block shrink-0 md:border-r border-neutral-400 md:px-[14px] md:py-[18px] overflow-auto md:max-h-none md:w-[260px]">
        {clients.map((c) => (
          <ClientListItem
            key={c.id}
            name={c.name}
            color={colorOf(c.id)}
            count={clientOpenCounts[c.id] ?? 0}
            active={c.id === selectedClient}
            onClick={() => setSelectedClient(c.id)}
            className="w-full mb-[3px]"
          />
        ))}
        <Button variant="dashed" size="md" onClick={() => openClientEditor()} className="w-full mt-2">
          <span className="text-[15px] leading-none">+</span> Add client
        </Button>

        {/* Retired clients, folded away — still openable, so their history and
            the Restore button stay one click from here. */}
        {archivedClients.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-325">
            <button
              onClick={() => setShowArchivedClients(!showArchivedClients)}
              className="group flex items-center gap-[6px] w-full px-3 py-[6px] bg-transparent border-none cursor-pointer text-neutral-675"
            >
              <DisclosureIcon open={showArchivedClients} size={10} />
              <SectionLabel className="group-hover:text-neutral-825">
                Archived · {archivedClients.length}
              </SectionLabel>
            </button>
            {showArchivedClients &&
              archivedClients.map((c) => (
                <ClientListItem
                  key={c.id}
                  name={c.name}
                  color={colorOf(c.id)}
                  count={clientOpenCounts[c.id] ?? 0}
                  active={c.id === selectedClient}
                  dimmed
                  title={`${c.name} — archived`}
                  onClick={() => setSelectedClient(c.id)}
                  className="w-full mb-[3px]"
                />
              ))}
          </div>
        )}
      </div>
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

        {/* Who the client is and where their things live — the context you want
            in front of you before touching their tasks. */}
        {hasClientInfo && (
          <Card padding="md" className="mb-7">
            {clientDescription && (
              <div
                className="wl-md text-body leading-[1.6] text-neutral-825"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(clientDescription) }}
              />
            )}
            {clientLinks.length > 0 && (
              <div className={'flex flex-col gap-1 ' + (clientDescription ? 'mt-[14px] pt-[14px] border-t border-neutral-325' : '')}>
                {clientLinks.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-[7px] text-control-lg text-info hover:underline w-fit"
                  >
                    <ExternalLinkIcon size={14} />
                    {l.label || l.url}
                  </a>
                ))}
              </div>
            )}
          </Card>
        )}

        <SectionLabel className="mb-[14px]">Open tasks · {selectedOpenCount}</SectionLabel>
        <Card padding="list" className="mb-[38px]">
          {selectedOpenRows.map((r) => <WorklogTaskRow key={r.id} row={r} />)}
          {selectedOpenCount === 0 && <EmptyState className="py-2 px-2.5">No open tasks.</EmptyState>}
        </Card>

        <SectionLabel className="mb-[14px]">Recently completed</SectionLabel>
        {selectedDone.length === 0 && <EmptyState>Nothing archived yet for {selectedName || 'this client'}.</EmptyState>}
        {selectedDone.length > 0 && (
          <Card tone="muted" padding="list">
            {selectedDone.map((t) => (
              <CompletedTaskRow
                key={t.id}
                task={t}
                onOpen={() => openDetail(t)}
                status={statusMeta(t.status, true).label}
                meta={t.completed ? fmtShort(t.completed) : ''}
              />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
