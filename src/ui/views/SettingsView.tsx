import React, { useEffect, useState } from 'react';
import { useData } from '../context';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** App configuration, persisted to .worklog/config.json. Covers the scalar
 *  settings not managed elsewhere (clients live in the Clients view). */
export function SettingsView() {
  const { hoursPerDay, weekStart, autoSync, saveSettings } = useData();

  const [hours, setHours] = useState(String(hoursPerDay));
  const [week, setWeek] = useState(weekStart);
  const [syncEnabled, setSyncEnabled] = useState(autoSync.enabled);
  const [syncDelay, setSyncDelay] = useState(String(autoSync.delayMinutes));
  const [saved, setSaved] = useState(false);

  // Re-seed from the snapshot after it re-derives (initial load, save, repo switch).
  useEffect(() => {
    setHours(String(hoursPerDay));
  }, [hoursPerDay]);
  useEffect(() => {
    setWeek(weekStart);
  }, [weekStart]);
  useEffect(() => {
    setSyncEnabled(autoSync.enabled);
  }, [autoSync.enabled]);
  useEffect(() => {
    setSyncDelay(String(autoSync.delayMinutes));
  }, [autoSync.delayMinutes]);

  const parsedHours = parseFloat(hours);
  const hoursValid = Number.isFinite(parsedHours) && parsedHours > 0;

  const parsedDelay = parseInt(syncDelay, 10);
  const delayValid = Number.isInteger(parsedDelay) && parsedDelay >= 1;

  const dirty =
    (hoursValid && parsedHours !== hoursPerDay) ||
    week !== weekStart ||
    syncEnabled !== autoSync.enabled ||
    (delayValid && parsedDelay !== autoSync.delayMinutes);

  const canSave = dirty && hoursValid && (!syncEnabled || delayValid);

  const onSave = () => {
    if (!canSave) {
      return;
    }
    saveSettings({
      hoursPerDay: parsedHours,
      weekStart: week,
      autoSync: { enabled: syncEnabled, delayMinutes: parsedDelay },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[640px] mx-auto">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold m-0">Settings</h1>
          <p className="text-[13px] text-[#6E7781] mt-1 mb-0">
            App configuration, stored in <code className="text-[12px] bg-[#F1F2F4] rounded px-[5px] py-[1px]">.worklog/config.json</code> in this repository.
          </p>
        </div>

        <div className="border border-[#ECEEF1] rounded-[14px] bg-white divide-y divide-[#F1F2F4]">
          <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
            <div>
              <div className="text-[14.5px] font-semibold">Hours per day</div>
              <div className="text-[13px] text-[#6E7781] mt-[3px]">
                A full working day. Drives the “full / ½ day” labels and insights.
              </div>
            </div>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-[96px] shrink-0 px-3 py-[8px] border border-[#D0D7DE] rounded-[8px] text-[14px] text-right focus:outline-none focus:border-[#E2BE2E]"
            />
          </div>

          <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
            <div>
              <div className="text-[14.5px] font-semibold">Week starts on</div>
              <div className="text-[13px] text-[#6E7781] mt-[3px]">
                First day of the week in the calendar grid.
              </div>
            </div>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="w-[140px] shrink-0 px-3 py-[8px] border border-[#D0D7DE] rounded-[8px] text-[14px] bg-white cursor-pointer focus:outline-none focus:border-[#E2BE2E]"
            >
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
            <div>
              <div className="text-[14.5px] font-semibold">Automatic Git sync</div>
              <div className="text-[13px] text-[#6E7781] mt-[3px]">
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
                (syncEnabled ? 'bg-[#F4CF4D] border-[#E2BE2E]' : 'bg-[#E5E7EB] border-[#D0D7DE]')
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
            <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
              <div>
                <div className="text-[14.5px] font-semibold">Sync delay</div>
                <div className="text-[13px] text-[#6E7781] mt-[3px]">
                  Minutes to wait after your last change before syncing. A burst of edits is coalesced into a single sync.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={syncDelay}
                  onChange={(e) => setSyncDelay(e.target.value)}
                  className="w-[80px] px-3 py-[8px] border border-[#D0D7DE] rounded-[8px] text-[14px] text-right focus:outline-none focus:border-[#E2BE2E]"
                />
                <span className="text-[13px] text-[#6E7781]">min</span>
              </div>
            </div>
          )}
        </div>

        {!hoursValid && (
          <div className="text-[13px] text-[#DC2626] mt-3">Hours per day must be greater than 0.</div>
        )}
        {syncEnabled && !delayValid && (
          <div className="text-[13px] text-[#DC2626] mt-3">Sync delay must be a whole number of at least 1 minute.</div>
        )}

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onSave}
            disabled={!canSave}
            className="px-[16px] py-[9px] rounded-[8px] text-[13px] font-semibold cursor-pointer border border-[#E2BE2E] bg-[#F4CF4D] text-[#3A2E05] hover:bg-[#F2C835] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
          {saved && <span className="text-[13px] text-[#16A34A] font-medium">Saved</span>}
        </div>
      </div>
    </div>
  );
}
