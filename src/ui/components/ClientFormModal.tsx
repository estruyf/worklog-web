import React from 'react';
import { PALETTE } from '../utils';
import { useData, useUi } from '../context';

/** Add / edit client modal (name + color). */
export function ClientFormModal() {
  const { editingClientId, cName: name, setCName: setName, cColor: color, setCColor: setColor, setClientModalOpen } = useUi();
  const { saveClient: onSave } = useData();
  const onClose = () => setClientModalOpen(false);
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
