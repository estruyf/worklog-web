import React, { useEffect, useId, useState } from 'react';
import { Button, Input, Select } from '../primitives';
import { useData } from '../context';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One setting per row: what it is and what it does on the left, the control on
 *  the right. Not a `Field` — that stacks label over control, and here the
 *  explanation is long enough that the two want to sit side by side. The label
 *  is still a real `<label>`, so clicking the name focuses the control. */
function SettingRow({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
      <div>
        <label htmlFor={id} className="text-[14.5px] font-semibold">
          {title}
        </label>
        <div className="text-[13px] text-neutral-675 mt-[3px]">{description}</div>
      </div>
      {children}
    </div>
  );
}

/** App configuration, persisted to .worklog/config.json. Covers the scalar
 *  settings not managed elsewhere (clients live in the Clients view). */
export function SettingsView() {
  const { hoursPerDay, weekStart, todosPerPage, autoSync, saveSettings } = useData();

  const [hours, setHours] = useState(String(hoursPerDay));
  const [week, setWeek] = useState(weekStart);
  const [todoPage, setTodoPage] = useState(String(todosPerPage));
  const [syncEnabled, setSyncEnabled] = useState(autoSync.enabled);
  const [syncDelay, setSyncDelay] = useState(String(autoSync.delayMinutes));
  const [saved, setSaved] = useState(false);
  const ids = useId();

  // Re-seed from the snapshot after it re-derives (initial load, save, repo switch).
  useEffect(() => {
    setHours(String(hoursPerDay));
  }, [hoursPerDay]);
  useEffect(() => {
    setWeek(weekStart);
  }, [weekStart]);
  useEffect(() => {
    setTodoPage(String(todosPerPage));
  }, [todosPerPage]);
  useEffect(() => {
    setSyncEnabled(autoSync.enabled);
  }, [autoSync.enabled]);
  useEffect(() => {
    setSyncDelay(String(autoSync.delayMinutes));
  }, [autoSync.delayMinutes]);

  const parsedHours = parseFloat(hours);
  const hoursValid = Number.isFinite(parsedHours) && parsedHours > 0;

  const parsedTodoPage = parseInt(todoPage, 10);
  const todoPageValid = Number.isInteger(parsedTodoPage) && parsedTodoPage >= 1;

  const parsedDelay = parseInt(syncDelay, 10);
  const delayValid = Number.isInteger(parsedDelay) && parsedDelay >= 1;

  const dirty =
    (hoursValid && parsedHours !== hoursPerDay) ||
    week !== weekStart ||
    (todoPageValid && parsedTodoPage !== todosPerPage) ||
    syncEnabled !== autoSync.enabled ||
    (delayValid && parsedDelay !== autoSync.delayMinutes);

  const canSave = dirty && hoursValid && todoPageValid && (!syncEnabled || delayValid);

  const onSave = () => {
    if (!canSave) {
      return;
    }
    saveSettings({
      hoursPerDay: parsedHours,
      weekStart: week,
      todosPerPage: parsedTodoPage,
      autoSync: { enabled: syncEnabled, delayMinutes: parsedDelay },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] mx-auto">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold m-0">Settings</h1>
          <p className="text-[13px] text-neutral-675 mt-1 mb-0">
            App configuration, stored in <code className="text-[12px] bg-neutral-250 rounded px-[5px] py-[1px]">.worklog/config.json</code> in this repository.
          </p>
        </div>

        <div className="border border-neutral-375 rounded-[14px] bg-white divide-y divide-neutral-250">
          <SettingRow
            id={`${ids}-hours`}
            title="Hours per day"
            description="A full working day. Drives the “full / ½ day” labels and insights."
          >
            <Input
              id={`${ids}-hours`}
              type="number"
              min={0.5}
              step={0.5}
              value={hours}
              invalid={!hoursValid}
              onChange={(e) => setHours(e.target.value)}
              className="w-[96px] shrink-0 text-right"
            />
          </SettingRow>

          <SettingRow
            id={`${ids}-week`}
            title="Week starts on"
            description="First day of the week in the calendar grid."
          >
            <Select
              id={`${ids}-week`}
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="w-[140px] shrink-0"
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </SettingRow>

          <SettingRow
            id={`${ids}-todos`}
            title="To-dos per page"
            description="How many open to-dos the day view’s side list shows at once. Anything beyond that pages."
          >
            <Input
              id={`${ids}-todos`}
              type="number"
              min={1}
              step={1}
              value={todoPage}
              invalid={!todoPageValid}
              onChange={(e) => setTodoPage(e.target.value)}
              className="w-[96px] shrink-0 text-right"
            />
          </SettingRow>

          <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
            <div>
              <div className="text-[14.5px] font-semibold">Automatic Git sync</div>
              <div className="text-[13px] text-neutral-675 mt-[3px]">
                Commit and push in the background shortly after you log time, so your timesheet doesn’t sit unpushed. Only errors are shown.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={syncEnabled}
              onClick={() => setSyncEnabled((v) => !v)}
              className={
                'relative shrink-0 w-[42px] h-[24px] rounded-full transition-colors cursor-pointer border ' +
                (syncEnabled ? 'bg-brand-450 border-brand-500' : 'bg-neutral-400 border-neutral-525')
              }
            >
              <span
                className={
                  'absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all ' +
                  (syncEnabled ? 'left-[21px]' : 'left-[2px]')
                }
              />
            </button>
          </div>

          {syncEnabled && (
            <SettingRow
              id={`${ids}-delay`}
              title="Sync delay"
              description="Minutes to wait after your last change before syncing. A burst of edits is coalesced into a single sync."
            >
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id={`${ids}-delay`}
                  type="number"
                  min={1}
                  step={1}
                  value={syncDelay}
                  invalid={!delayValid}
                  onChange={(e) => setSyncDelay(e.target.value)}
                  className="w-[80px] text-right"
                />
                <span className="text-[13px] text-neutral-675">min</span>
              </div>
            </SettingRow>
          )}
        </div>

        {!hoursValid && (
          <div className="text-[13px] text-danger-675 mt-3">Hours per day must be greater than 0.</div>
        )}
        {!todoPageValid && (
          <div className="text-[13px] text-danger-675 mt-3">To-dos per page must be a whole number of at least 1.</div>
        )}
        {syncEnabled && !delayValid && (
          <div className="text-[13px] text-danger-675 mt-3">Sync delay must be a whole number of at least 1 minute.</div>
        )}

        <div className="flex items-center gap-3 mt-6">
          <Button variant="primary" size="md" onClick={onSave} disabled={!canSave}>
            Save changes
          </Button>
          {saved && <span className="text-[13px] text-success-500 font-medium">Saved</span>}
        </div>
      </div>
    </div>
  );
}
