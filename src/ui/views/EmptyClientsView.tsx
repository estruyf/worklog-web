import React, { useState } from 'react';
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
          <input
            autoFocus
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void onCreateClient();
              }
            }}
            placeholder="Client name (e.g. Acme Inc)"
            className="flex-1 px-[14px] py-[11px] border border-neutral-525 rounded-[9px] text-[14px] outline-none focus:border-brand-500 focus:shadow-[0_0_0_3px_var(--color-brand-225)]"
          />
          <button
            onClick={() => void onCreateClient()}
            className="px-[18px] py-[11px] border border-brand-500 rounded-[9px] bg-brand-450 text-brand-800 font-semibold text-[14px] cursor-pointer hover:bg-brand-475"
          >
            Add client
          </button>
        </div>
      </div>
    </div>
  );
}
