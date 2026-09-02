import React, { useState } from 'react';
import { EVENT_TYPES, eventWorklogClientId } from '../../../model/worklog';
import { useData } from '../../context';
import { Button, DateInput, Field, Input, Select, Toggle } from '../../primitives';
import { datesInRange, fmtShort, roundHours, weekdayShort, withoutWeekends } from '../../utils';

export interface RangeLogBarProps {
  /** The range's first day, or '' before one has been picked. */
  from: string;
  /** Its last day. Empty while the grid is waiting for the second click — which
   *  is the state the bar exists to spell out. */
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  /** Leaves selection mode and forgets the picked days. */
  onClear: () => void;
  onLog: (input: { dates: string[]; clientId: string; hours: number; note?: string }) => void;
}

/** The action bar above the grid while days are being picked: what to log on all
 *  of them, and the one button that writes it. Same fields as the day view's
 *  `LogForm` and in the same order — this is that form with a range of dates
 *  instead of one, and it writes the same ledger lines.
 *
 *  It holds its own draft rather than the day form's shared UI state: the two are
 *  never open at once, and a range's amount is not the last day's amount.
 *
 *  The two ends are shown as fields, not just as highlighted cells: clicking two
 *  days is only obvious once something on screen says which day you are picking,
 *  and a range typed here beats paging the grid to reach a distant month. */
export function RangeLogBar({ from, to, onChange, onClear, onLog }: RangeLogBarProps) {
  const { clients, hoursPerDay, colorOf } = useData();
  const [isEvent, setIsEvent] = useState(true);
  const [eventType, setEventType] = useState('vacation');
  // Empty means "the first client", resolved at render: the list arrives with the
  // snapshot, which is after this bar can first mount.
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('full');
  const [hours, setHours] = useState(String(hoursPerDay || 8));
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [note, setNote] = useState('');

  const clientId = client || clients[0]?.id || '';
  const target = isEvent ? eventWorklogClientId(eventType) : clientId;
  // One end picked is a one-day range: logging it is a fair reading of "Log", and
  // the button says how many days it is about to write either way.
  const dates = from ? datesInRange(from, to || from) : [];
  const days = skipWeekends ? withoutWeekends(dates) : dates;
  const amountHours =
    amount === 'full' ? hoursPerDay : amount === 'half' ? hoursPerDay / 2 : roundHours(Math.max(0, parseFloat(hours) || 0));
  const canLog = days.length > 0 && !!target && amountHours > 0;

  const dayLabel = (d: string) => `${weekdayShort(d)} ${fmtShort(d)}`;
  // Says which of the two clicks the grid is waiting for, then what was picked.
  const summary = !from
    ? 'Click the first day of the range'
    : !to
      ? `From ${dayLabel(from)} — now click the last day`
      : `${dayLabel(from)} → ${dayLabel(to)} · ${days.length} ${days.length === 1 ? 'day' : 'days'}${
          skipWeekends && days.length !== dates.length ? ' · weekends skipped' : ''
        }`;

  return (
    // A real <form>, so Enter anywhere in it logs the range — the same bargain the
    // day view's log form makes.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onLog({ dates: days, clientId: target, hours: amountHours, note: note.trim() || undefined });
      }}
      className="mb-3 px-4 py-[14px] bg-brand-100 border border-brand-400 rounded-panel"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-control font-semibold">{summary}</div>
        <Button type="button" size="xs" onClick={onClear} title="Stop picking days">
          Cancel
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-[14px]">
        <Field label="From" labelSize="xs" className="min-w-[150px]">
          <DateInput size="sm" value={from} onChange={(e) => onChange({ from: e.target.value, to })} />
        </Field>
        <Field label="To" labelSize="xs" className="min-w-[150px]">
          <DateInput size="sm" value={to} onChange={(e) => onChange({ from, to: e.target.value })} />
        </Field>
        <div>
          <div className="text-eyebrow text-neutral-675 mb-[6px]">Type</div>
          <div className="flex gap-[6px]">
            {[
              { event: true, label: 'Event' },
              { event: false, label: 'Client' },
            ].map(({ event, label }) => (
              <button
                type="button"
                key={label}
                onClick={() => setIsEvent(event)}
                className={
                  'px-3 py-[7px] rounded-control text-control cursor-pointer border ' +
                  (isEvent === event ? 'border-brand-500 bg-brand-225 font-semibold' : 'border-neutral-525 bg-white font-normal')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {isEvent ? (
          <Field label="Event" labelSize="xs">
            <Select size="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_TYPES.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Client" labelSize="xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(clientId) }} />
              <Select size="sm" value={clientId} onChange={(e) => setClient(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
        )}
        <div>
          <div className="text-eyebrow text-neutral-675 mb-[6px]">Amount</div>
          <div className="flex gap-[6px]">
            {[
              { t: 'full', label: 'Full day' },
              { t: 'half', label: '½ day' },
              { t: 'hours', label: 'Hours' },
            ].map(({ t, label }) => (
              <button
                type="button"
                key={t}
                onClick={() => setAmount(t)}
                className={
                  'px-3 py-[7px] rounded-control text-control cursor-pointer border ' +
                  (amount === t ? 'border-brand-500 bg-brand-225 font-semibold' : 'border-neutral-525 bg-white font-normal')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {amount === 'hours' && (
          <Field label="Hours" labelSize="xs" className="w-24">
            <Input
              size="sm"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              type="number"
              min="0"
              step="0.5"
              className="w-full"
            />
          </Field>
        )}
        <div>
          <div className="text-eyebrow text-neutral-675 mb-[6px]">Weekends</div>
          <div className="flex items-center gap-2 h-[34px]">
            <Toggle checked={skipWeekends} onChange={setSkipWeekends} aria-label="Skip weekends" />
            <span className="text-control text-neutral-750">Skip</span>
          </div>
        </div>
        <Field label="Note" hint="optional" labelSize="xs" className="flex-1 min-w-[180px]">
          <Input size="sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="on every day" className="w-full" />
        </Field>
        <Button
          variant="primary"
          size="md"
          type="submit"
          disabled={!canLog}
          title={dates.length === 0 ? 'Pick the first and last day in the grid first' : undefined}
        >
          {days.length > 0 ? `Log ${days.length} ${days.length === 1 ? 'day' : 'days'}` : 'Log'}
        </Button>
      </div>
    </form>
  );
}
