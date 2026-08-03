import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Client } from '../../../model/types';
import { EVENT_TYPES } from '../../../model/worklog';
import { Button, Field, Input, Select } from '../../primitives';
import type { LogState } from '../../model';

type LogFormProps = {
  logState: LogState;
  setLogState: (state: LogState) => void;
  saveLog: () => void;
  removeLog: () => void;
  /** Closes the form *and* forgets which entry it was on — `open: false` alone
   *  would leave the day bar highlighting a segment nothing is editing. */
  close: () => void;
  clients: Client[];
  colorOf: (clientId: string) => string;
};

export function LogForm({ logState, setLogState, saveLog, removeLog, close, clients, colorOf }: LogFormProps) {
  const editing = !!logState.editingClientId;
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
    // A panel inside the day card, not a section of its own: `rounded-panel` is
    // the corner for a box whose outer one has already been paid for.
    <div className="px-5 py-[18px] mt-4 bg-neutral-75 border border-neutral-400 rounded-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="text-control font-semibold">{editing ? 'Edit logged time' : 'Log time'}</div>
        <button
          onClick={close}
          className="bg-none border-none text-[17px] text-neutral-625 cursor-pointer leading-none"
        >
          ×
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-[14px]">
        <div>
          <div className="text-eyebrow text-neutral-675 mb-[6px]">Type</div>
          <div className="flex gap-[6px]">
            <button
              onClick={() => setLogState({ ...logState, isEvent: false })}
              className={
                'px-3 py-[7px] rounded-control text-control cursor-pointer border ' +
                (!logState.isEvent ? 'border-brand-500 bg-brand-225 font-semibold' : 'border-neutral-525 bg-white font-normal')
              }
            >
              Client
            </button>
            <button
              onClick={() => setLogState({ ...logState, isEvent: true })}
              className={
                'px-3 py-[7px] rounded-control text-control cursor-pointer border ' +
                (logState.isEvent ? 'border-brand-500 bg-brand-225 font-semibold' : 'border-neutral-525 bg-white font-normal')
              }
            >
              Event
            </button>
          </div>
        </div>
        <div>
          {logState.isEvent ? (
            <>
              <Field label="Event" labelSize="xs">
                <Select
                  size="sm"
                  value={logState.eventType}
                  onChange={(e) => setLogState({ ...logState, eventType: e.target.value })}
                >
                  {EVENT_TYPES.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <>
              <div className="text-eyebrow text-neutral-675 mb-[6px]">Client</div>
              <div ref={clientPickerRef} className="relative min-w-[220px]">
                <button
                  onClick={() => setClientPickerOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-[9px] border border-neutral-525 rounded-control-md bg-white text-control cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selectedClient ? colorOf(selectedClient.id) : '#9AA0A6' }} />
                    <span className="truncate font-semibold text-neutral-825">{selectedClient?.name || 'Select client'}</span>
                  </span>
                  <span className="text-neutral-675" aria-hidden="true">
                    {clientPickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                {clientPickerOpen && (
                  <div className="absolute left-0 top-full mt-2 w-[280px] max-w-[80vw] border border-neutral-525 rounded-[10px] bg-white shadow-[0_14px_30px_rgba(0,0,0,0.14)] p-2 z-20">
                    <Input
                      size="sm"
                      value={clientQuery}
                      onChange={(e) => setClientQuery(e.target.value)}
                      aria-label="Search client"
                      placeholder="Search client"
                      className="w-full mb-2"
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
                              'w-full flex items-center gap-2 px-3 py-2 rounded-control-md text-control text-left cursor-pointer mb-1 border ' +
                              (active ? 'border-brand-500 bg-brand-225 font-semibold text-brand-800' : 'border-transparent bg-white text-neutral-825 hover:bg-neutral-225')
                            }
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(c.id) }} />
                            <span className="truncate">{c.name}</span>
                          </button>
                        );
                      })}
                      {filteredClients.length === 0 && <div className="px-3 py-2 text-meta italic text-neutral-650">No clients found</div>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="text-eyebrow text-neutral-675 mb-[6px]">Amount</div>
          <div className="flex gap-[6px]">
            {[
              { t: 'full', label: 'Full day' },
              { t: 'half', label: '½ day' },
              { t: 'hours', label: 'Hours' },
            ].map(({ t, label }) => {
              const active = logState.type === t;
              return (
                <button
                  key={t}
                  onClick={() => setLogState({ ...logState, type: t })}
                  className={
                    'px-3 py-[7px] rounded-control text-control cursor-pointer border ' +
                    (active ? 'border-brand-500 bg-brand-225 font-semibold' : 'border-neutral-525 bg-white font-normal')
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {logState.type === 'hours' && (
          <Field label="Hours" labelSize="xs" className="w-24">
            <Input
              size="sm"
              value={logState.hours}
              onChange={(e) => setLogState({ ...logState, hours: e.target.value })}
              type="number"
              min="0"
              step="0.5"
              className="w-full"
            />
          </Field>
        )}
        <Field label="Note" hint="optional" labelSize="xs" className="flex-1 min-w-[180px]">
          <Input
            size="sm"
            value={logState.note}
            onChange={(e) => setLogState({ ...logState, note: e.target.value })}
            placeholder="what you worked on"
            className="w-full"
          />
        </Field>
        <Button variant="primary" size="md" onClick={saveLog}>
          {editing ? 'Save' : 'Log'}
        </Button>
        {editing && (
          <Button variant="danger" size="md" onClick={removeLog} title="Remove this entry">
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
