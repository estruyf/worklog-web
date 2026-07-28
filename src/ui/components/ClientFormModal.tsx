import React from 'react';
import { PALETTE } from '../utils';
import { useData, useUi } from '../context';

/** Add / edit client modal (name + color), plus the two ways to retire one:
 *  archive (reversible, keeps every task and ledger entry) and delete (only for
 *  a client that never accumulated any). */
export function ClientFormModal() {
  const { editingClientId, cName: name, setCName: setName, cColor: color, setCColor: setColor, setClientModalOpen } = useUi();
  const { saveClient: onSave, allClients, clientUsage, setClientArchived, deleteClient } = useData();
  const onClose = () => setClientModalOpen(false);
  const editing = editingClientId ? allClients.find((c) => c.id === editingClientId) : undefined;
  const usage = editingClientId ? clientUsage(editingClientId) : { tasks: 0, worklog: 0 };
  const deletable = usage.tasks === 0 && usage.worklog === 0;
  return (
    <div onClick={onClose} className="fixed inset-0 bg-overlay flex items-start justify-center pt-[12vh] z-50">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[14px] w-[460px] max-w-[92vw] px-[30px] pt-[26px] pb-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between mb-[22px]">
          <h2 className="text-[20px] font-bold m-0">{editingClientId ? 'Edit client' : 'New client'}</h2>
          <button onClick={onClose} className="bg-none border-none text-[20px] text-neutral-650 cursor-pointer leading-none">
            ×
          </button>
        </div>

        <label className="block font-semibold text-[14px] mb-2">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave();
            }
          }}
          placeholder="Acme Inc"
          className="w-full px-[14px] py-[11px] border border-brand-500 rounded-[9px] text-[14px] shadow-[0_0_0_3px_var(--color-brand-225)] mb-[22px] outline-none"
        />

        <label className="block font-semibold text-[14px] mb-[10px]">Color</label>
        <div className="flex flex-wrap gap-[10px] mb-2">
          {PALETTE.map((p) => {
            const active = color.toLowerCase() === p.toLowerCase();
            return (
              <button
                key={p}
                onClick={() => setColor(p)}
                title={p}
                className={'w-7 h-7 rounded-full cursor-pointer border-2 ' + (active ? 'border-brand-800' : 'border-transparent')}
                style={{ background: p }}
              />
            );
          })}
        </div>

        {editingClientId && <div className="text-[12px] text-neutral-625 mt-3">Client id <code className="text-neutral-675">{editingClientId}</code> stays the same; only the name and color change.</div>}

        {editing && (
          <div className="mt-5 pt-4 border-t border-neutral-325">
            <div className="text-[11px] font-bold tracking-[0.06em] text-neutral-675 mb-[10px]">RETIRE THIS CLIENT</div>
            <div className="flex flex-wrap items-center gap-[10px]">
              <button
                onClick={() => setClientArchived(editing, !editing.archived)}
                className="px-[14px] py-[8px] border border-neutral-400 rounded-[8px] bg-white text-neutral-750 text-[13px] font-semibold cursor-pointer hover:bg-neutral-200"
              >
                {editing.archived ? 'Restore client' : 'Archive client'}
              </button>
              <button
                onClick={() => deleteClient(editing)}
                disabled={!deletable}
                title={deletable ? 'Delete this client' : 'Only a client with no tasks and no logged time can be deleted'}
                className="px-[14px] py-[8px] border border-danger-225 rounded-[8px] bg-white text-danger-675 text-[13px] font-semibold cursor-pointer hover:bg-danger-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Delete client
              </button>
            </div>
            <div className="text-[12px] text-neutral-625 mt-[10px]">
              {editing.archived
                ? 'Archived: hidden from the pickers, the day view and the log form. Its history is untouched and still shows in Insights, Archive and search.'
                : 'Archiving hides it from the pickers and lists but keeps every task and logged hour.'}
              {!deletable && (
                <>
                  {' '}
                  Deleting is unavailable — it still has {usage.tasks} task{usage.tasks === 1 ? '' : 's'} and {usage.worklog} time
                  entr{usage.worklog === 1 ? 'y' : 'ies'}.
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-[10px] mt-[26px]">
          <button onClick={onClose} className="px-5 py-[10px] border border-neutral-400 rounded-[9px] bg-neutral-250 text-[14px] font-semibold cursor-pointer">
            Close
          </button>
          <button
            onClick={onSave}
            className={
              'px-[22px] py-[10px] rounded-[9px] text-[14px] font-semibold border ' +
              (name.trim() ? 'border-brand-500 bg-brand-450 text-brand-800 cursor-pointer' : 'border-brand-375 bg-brand-175 text-brand-550 cursor-not-allowed')
            }
          >
            {editingClientId ? 'Save client' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  );
}
