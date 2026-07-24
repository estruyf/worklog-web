import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Client } from '../../../model/types';
import { LogState } from '../../model';

type LogFormProps = {
  logState: LogState;
  setLogState: (state: LogState) => void;
  saveLog: () => void;
  removeLog: () => void;
  clients: Client[];
  colorOf: (clientId: string) => string;
};

export function LogForm({ logState, setLogState, saveLog, removeLog, clients, colorOf }: LogFormProps) {
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const clientPickerRef = useRef<HTMLDivElement | null>(null);

  const selectedClient = useMemo(() => clients.find((c) => c.id === logState.client), [clients, logState.client]);
  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) {
      return clients;
    }
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, clientQuery]);

  useEffect(() => {
    if (!logState.open || logState.isEvent) {
      setClientPickerOpen(false);
      setClientQuery('');
    }
  }, [logState.open, logState.isEvent]);

  useEffect(() => {
    if (!clientPickerOpen) {
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      if (clientPickerRef.current && !clientPickerRef.current.contains(event.target as Node)) {
        setClientPickerOpen(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [clientPickerOpen]);

  return (
    <div className="px-5 py-[18px] bg-[#FBFBFC] border border-[#E5E7EB] rounded-xl mb-[34px]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold">{logState.editing ? 'Edit logged time' : 'Log time'}</div>
        <button
          onClick={() => setLogState({ ...logState, open: false })}
          className="bg-none border-none text-[17px] text-[#9AA0A6] cursor-pointer leading-none"
        >
          ×
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-[14px]">
        <div>
          <div className="text-[11px] text-[#6E7781] mb-[6px]">Type</div>
          <div className="flex gap-[6px]">
            <button
              onClick={() => setLogState({ ...logState, isEvent: false })}
              className={
                'px-3 py-[7px] rounded-[7px] text-[13px] cursor-pointer border ' +
                (!logState.isEvent ? 'border-[#E2BE2E] bg-[#FBEFC0] font-semibold' : 'border-[#D0D7DE] bg-white font-normal')
              }
            >
              Client
            </button>
            <button
              onClick={() => setLogState({ ...logState, isEvent: true })}
              className={
                'px-3 py-[7px] rounded-[7px] text-[13px] cursor-pointer border ' +
                (logState.isEvent ? 'border-[#E2BE2E] bg-[#FBEFC0] font-semibold' : 'border-[#D0D7DE] bg-white font-normal')
              }
            >
              Event
            </button>
          </div>
        </div>
        <div>
          {logState.isEvent ? (
            <>
              <div className="text-[11px] text-[#6E7781] mb-[6px]">Event</div>
              <select
                value={logState.eventType}
                onChange={(e) => setLogState({ ...logState, eventType: e.target.value })}
                className="px-3 py-[9px] border border-[#D0D7DE] rounded-lg text-[13px] bg-white"
              >
                <option value="vacation">Vacation</option>
                <option value="out-of-office">Out of office</option>
                <option value="conference">Conference</option>
                <option value="sick">Sick day</option>
                <option value="other">Other</option>
              </select>
            </>
          ) : (
            <>
              <div className="text-[11px] text-[#6E7781] mb-[6px]">Client</div>
              <div ref={clientPickerRef} className="relative min-w-[220px]">
                <button
                  onClick={() => setClientPickerOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-[9px] border border-[#D0D7DE] rounded-lg bg-white text-[13px] cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedClient ? colorOf(selectedClient.id) : '#9AA0A6' }} />
                    <span className="truncate font-semibold text-[#1F2328]">{selectedClient?.name || 'Select client'}</span>
                  </span>
                  <span className="text-[#6E7781]" aria-hidden="true">
                    {clientPickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                {clientPickerOpen && (
                  <div className="absolute left-0 top-full mt-2 w-[280px] max-w-[80vw] border border-[#D0D7DE] rounded-[10px] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.14)] p-2 z-20">
                    <input
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      placeholder="Search client"
                      className="w-full px-3 py-[8px] border border-[#E5E7EB] rounded-[8px] text-[13px] mb-2 outline-none"
                    />
                    <div className="max-h-[180px] overflow-auto pr-1">
                      {filteredClients.map((c) => {
                        const active = c.id === logState.client;
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setLogState({ ...logState, client: c.id });
                              setClientPickerOpen(false);
                              setClientQuery('');
                            }}
                            className={
                              'w-full flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] text-left cursor-pointer mb-1 border ' +
                              (active ? 'border-[#E2BE2E] bg-[#FBEFC0] font-semibold text-[#3A2E05]' : 'border-transparent bg-white text-[#1F2328] hover:bg-[#F4F5F7]')
                            }
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(c.id) }} />
                            <span className="truncate">{c.name}</span>
                          </button>
                        );
                      })}
                      {filteredClients.length === 0 && <div className="px-3 py-2 text-[12px] italic text-[#8A9099]">No clients found</div>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="text-[11px] text-[#6E7781] mb-[6px]">Amount</div>
          <div className="flex gap-[6px]">
            {[
              { t: 'full', label: 'Full day' },
              { t: 'half', label: '1/2 day' },
              { t: 'hours', label: 'Hours' },
            ].map(({ t, label }) => {
              const active = logState.type === t;
              return (
                <button
                  key={t}
                  onClick={() => setLogState({ ...logState, type: t })}
                  className={
                    'px-3 py-[7px] rounded-[7px] text-[13px] cursor-pointer border ' +
                    (active ? 'border-[#E2BE2E] bg-[#FBEFC0] font-semibold' : 'border-[#D0D7DE] bg-white font-normal')
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {logState.type === 'hours' && (
          <div className="w-24">
            <div className="text-[11px] text-[#6E7781] mb-[6px]">Hours</div>
            <input
              value={logState.hours}
              onChange={(e) => setLogState({ ...logState, hours: e.target.value })}
              type="number"
              min="0"
              step="0.5"
              className="w-full px-3 py-[9px] border border-[#D0D7DE] rounded-lg text-[13px]"
            />
          </div>
        )}
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] text-[#6E7781] mb-[6px]">Note (optional)</div>
          <input
            value={logState.note}
            onChange={(e) => setLogState({ ...logState, note: e.target.value })}
            placeholder="what you worked on"
            className="w-full px-3 py-[9px] border border-[#D0D7DE] rounded-lg text-[13px]"
          />
        </div>
        <button onClick={saveLog} className="px-[18px] py-[9px] border border-[#E2BE2E] rounded-lg bg-[#F4CF4D] text-[#3A2E05] font-semibold text-[13px] cursor-pointer">
          {logState.editing ? 'Save' : 'Log'}
        </button>
        {logState.editing && (
          <button onClick={removeLog} title="Remove this entry" className="px-[14px] py-[9px] border border-[#F0C9C9] rounded-lg bg-white text-[#DC2626] font-medium text-[13px] cursor-pointer">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
