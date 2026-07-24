import React from 'react';
import { PALETTE } from '../utils';
import { useData, useUi } from '../context';

/** Add / edit client modal (name + color). */
export function ClientFormModal() {
  const { editingClientId, cName: name, setCName: setName, cColor: color, setCColor: setColor, setClientModalOpen } = useUi();
  const { saveClient: onSave } = useData();
  const onClose = () => setClientModalOpen(false);
  return (
    <div onClick={onClose} className="fixed inset-0 bg-[rgba(30,33,40,0.45)] flex items-start justify-center pt-[12vh] z-50">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[14px] w-[460px] max-w-[92vw] px-[30px] pt-[26px] pb-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between mb-[22px]">
          <h2 className="text-[20px] font-bold m-0">{editingClientId ? 'Edit client' : 'New client'}</h2>
          <button onClick={onClose} className="bg-none border-none text-[20px] text-[#8A9099] cursor-pointer leading-none">
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
          className="w-full px-[14px] py-[11px] border border-[#E2BE2E] rounded-[9px] text-[14px] shadow-[0_0_0_3px_#FBEFC0] mb-[22px] outline-none"
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
                className={'w-7 h-7 rounded-full cursor-pointer border-2 ' + (active ? 'border-[#3A2E05]' : 'border-transparent')}
                style={{ background: p }}
              />
            );
          })}
        </div>

        {editingClientId && <div className="text-[12px] text-[#9AA0A6] mt-3">Client id <code className="text-[#6E7781]">{editingClientId}</code> stays the same; only the name and color change.</div>}

        <div className="flex justify-end gap-[10px] mt-[26px]">
          <button onClick={onClose} className="px-5 py-[10px] border border-[#E5E7EB] rounded-[9px] bg-[#F1F2F4] text-[14px] font-semibold cursor-pointer">
            Close
          </button>
          <button
            onClick={onSave}
            className={
              'px-[22px] py-[10px] rounded-[9px] text-[14px] font-semibold border ' +
              (name.trim() ? 'border-[#E2BE2E] bg-[#F4CF4D] text-[#3A2E05] cursor-pointer' : 'border-[#EBDFA8] bg-[#FBF1C8] text-[#B7A878] cursor-not-allowed')
            }
          >
            {editingClientId ? 'Save client' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  );
}
