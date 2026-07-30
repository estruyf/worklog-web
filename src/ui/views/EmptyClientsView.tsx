import React, { useState } from 'react';
import { Button, Input } from '../primitives';
import { useData, useUi } from '../context';

export function EmptyClientsView() {
  // The name being typed is this screen's own business — it exists only until the
  // first client does.
  const [newClientName, setNewClientName] = useState('');
  const { setSelectedClient } = useUi();
  const { createClient } = useData();
  const onCreateClient = async () => {
    const id = await createClient(newClientName);
    if (id) {
      setSelectedClient(id);
    }
  };
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-[440px] max-w-[92vw] text-center">
        <div className="text-[22px] font-bold mb-2 tracking-[-0.01em]">Welcome to Worklog</div>
        <div className="text-[14px] text-neutral-675 mb-7">No clients yet. Add your first client to get started.</div>
        <div className="flex gap-2">
          <Input
            autoFocus
            size="lg"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void onCreateClient();
              }
            }}
            aria-label="Client name"
            placeholder="Client name (e.g. Acme Inc)"
            className="flex-1"
          />
          <Button variant="primary" size="lg" onClick={() => void onCreateClient()}>
            Add client
          </Button>
        </div>
      </div>
    </div>
  );
}
