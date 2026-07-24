import React from 'react';
import { useData, useUi } from '../context';

export function EmptyClientsView() {
  const { newClientName, setNewClientName } = useUi();
  const { createClient } = useData();
  const onCreateClient = () => createClient(newClientName, 'selected');
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-[440px] max-w-[92vw] text-center">
        <div className="text-[22px] font-bold mb-2 tracking-[-0.01em]">Welcome to Worklog</div>
        <div className="text-[14px] text-[#6E7781] mb-7">No clients yet. Add your first client to get started.</div>
        <div className="flex gap-2">
          <input
            autoFocus
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onCreateClient();
              }
            }}
            placeholder="Client name (e.g. Acme Inc)"
            className="flex-1 px-[14px] py-[11px] border border-[#D0D7DE] rounded-[9px] text-[14px] outline-none focus:border-[#E2BE2E] focus:shadow-[0_0_0_3px_#FBEFC0]"
          />
          <button
            onClick={onCreateClient}
            className="px-[18px] py-[11px] border border-[#E2BE2E] rounded-[9px] bg-[#F4CF4D] text-[#3A2E05] font-semibold text-[14px] cursor-pointer hover:bg-[#F2C835]"
          >
            Add client
          </button>
        </div>
      </div>
    </div>
  );
}
