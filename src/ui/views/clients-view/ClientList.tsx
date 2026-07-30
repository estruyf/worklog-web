import React from 'react';
import type { Client } from '../../../model/types';
import { ClientListItem, DisclosureIcon } from '../../components';
import { Button, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';

export interface ClientListProps {
  clients: Client[];
  archivedClients: Client[];
  clientOpenCounts: Record<string, number>;
  onAdd: () => void;
}

/** The desktop rail: every active client with its open-task count, the add
 *  button, and the archived ones folded away below. Hidden on a phone, where
 *  `MobileClientDropdown` takes the same job in a control that fits. */
export function ClientList({ clients, archivedClients, clientOpenCounts, onAdd }: ClientListProps) {
  const { colorOf } = useData();
  const { selectedClient, setSelectedClient, showArchivedClients, setShowArchivedClients } = useUi();
  return (
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
      <Button variant="dashed" size="md" onClick={onAdd} className="w-full mt-2">
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
  );
}
