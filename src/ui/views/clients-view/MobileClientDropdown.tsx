import React, { useEffect, useRef, useState } from 'react';
import type { Client } from '../../../model/types';
import { ChevronDownIcon } from 'lucide-react';
import { ClientListItem } from '../../components';
import { Button, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';

export interface MobileClientDropdownProps {
  clients: Client[];
  archivedClients: Client[];
  selectedName: string;
  clientOpenCounts: Record<string, number>;
  onAdd: () => void;
}

/** Mobile-only client picker: a dropdown showing each client's colour dot,
 * name and open-task count. Replaces the sidebar list on narrow screens. */
export function MobileClientDropdown({
  clients,
  archivedClients,
  selectedName,
  clientOpenCounts,
  onAdd,
}: MobileClientDropdownProps) {
  const { colorOf } = useData();
  const { selectedClient, setSelectedClient } = useUi();
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

  const select = (id: string) => {
    setSelectedClient(id);
    setOpen(false);
  };

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
              onClick={() => select(c.id)}
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
                  onClick={() => select(c.id)}
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
