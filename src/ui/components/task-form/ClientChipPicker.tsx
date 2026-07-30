import React, { useMemo, useState } from 'react';
import { Button, Chip, Input, LinkButton } from '../../primitives';
import { useData } from '../../context';
import { GENERAL_TODO_CLIENT_ID, GENERAL_TODO_COLOR, GENERAL_TODO_LABEL } from '../../../model/todos';
import { SidebarSection } from './SidebarSection';

/** Who the task is for, as a row of chips rather than a select: the list is short,
 *  and picking is the single most common thing done in this rail. Includes the
 *  general to-do bucket, and can create a client without leaving the form. */
export function ClientChipPicker({ value, onChange }: { value: string; onChange: (clientId: string) => void }) {
  const { clients, allClients, colorOf, createClient } = useData();
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Archived clients aren't offered for new work, but a task already filed under
  // one keeps showing it — otherwise editing that task looks unassigned and the
  // next click silently moves it to another client.
  const pickableClients = useMemo(() => {
    const current = allClients.find((c) => c.id === value);
    return current?.archived ? [...clients, current] : clients;
  }, [clients, allClients, value]);

  // Adding a client from inside the form switches to it once the write lands.
  const onCreateClient = async (name: string) => {
    const id = await createClient(name);
    if (id) {
      onChange(id);
      setAddingClient(false);
      setNewClientName('');
    }
  };

  return (
    <SidebarSection title="Client" divider={false}>
      <div className="flex flex-wrap gap-[10px]">
        {pickableClients.map((c) => (
          <Chip
            key={c.id}
            variant="select"
            selected={c.id === value}
            onClick={() => onChange(c.id)}
            title={c.archived ? `${c.name} (archived)` : c.name}
          >
            <span className="w-[9px] h-[9px] rounded-full" style={{ background: colorOf(c.id) }} />
            {c.name}
          </Chip>
        ))}
        <Chip
          variant="select"
          selected={value === GENERAL_TODO_CLIENT_ID}
          onClick={() => onChange(GENERAL_TODO_CLIENT_ID)}
          title="A general to-do not linked to any client"
        >
          <span className="w-[9px] h-[9px] rounded-full" style={{ background: GENERAL_TODO_COLOR }} />
          {GENERAL_TODO_LABEL}
        </Chip>
        {!addingClient && (
          <Chip variant="add" onClick={() => setAddingClient(true)}>
            + Add client
          </Chip>
        )}
      </div>
      {addingClient && (
        <div className="flex flex-wrap gap-2 mt-[10px]">
          <Input
            autoFocus
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            onKeyDown={(e) => {
              // Bare ↵ only, for the same reason as the title field: ⌘↵ here
              // would add the client *and* save the task in one keypress.
              if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                void onCreateClient(newClientName);
              }
            }}
            aria-label="New client name"
            placeholder="New client name"
            className="flex-1 min-w-[150px]"
          />
          <Button variant="primary" size="md" onClick={() => void onCreateClient(newClientName)}>
            Add
          </Button>
          <LinkButton size="lg" onClick={() => setAddingClient(false)}>
            Cancel
          </LinkButton>
        </div>
      )}
    </SidebarSection>
  );
}
