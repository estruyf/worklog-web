import React, { useEffect, useId, useState } from 'react';
import { Button, Card, Input, Select, Toggle } from '../primitives';
import { useData } from '../context';
import { AUTO_SYNC_EVENTS, type AutoSyncEvent } from '../../model/syncEvents';
import { DEEPLINK_SCHEME } from '../deeplink';
import { canUnregisterProtocol, registerProtocol, unregisterProtocol, type ProtocolHandlerResult } from '../protocolHandler';

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
        <label htmlFor={id} className="text-row font-semibold">
          {title}
        </label>
        <div className="text-control text-neutral-675 mt-[3px]">{description}</div>
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
  const [syncEvents, setSyncEvents] = useState<AutoSyncEvent[]>(autoSync.events);
  const [saved, setSaved] = useState(false);
  const ids = useId();

  // The saved event list as a value, not a reference: `autoSync` is rebuilt from
  // config.json on every derive, so its `events` array is a fresh object each time
  // and depending on it would re-seed — discarding what's half-ticked here — on any
  // unrelated edit. The order is canonical (see parseAutoSyncEvents), so this is
  // stable for as long as the setting is.
  const savedEvents = autoSync.events.join(',');

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
  useEffect(() => {
    setSyncEvents(savedEvents ? (savedEvents.split(',') as AutoSyncEvent[]) : []);
  }, [savedEvents]);

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
    (delayValid && parsedDelay !== autoSync.delayMinutes) ||
    syncEvents.join(',') !== savedEvents;

  const canSave = dirty && hoursValid && todoPageValid && (!syncEnabled || delayValid);

  /** Tick an event on or off, keeping the list in the canonical order so saving
   *  the same set twice writes the same config.json. */
  const toggleEvent = (id: AutoSyncEvent, on: boolean) => {
    setSyncEvents(AUTO_SYNC_EVENTS.filter((e) => (e.id === id ? on : syncEvents.includes(e.id))).map((e) => e.id));
  };

  // The all-switch reads as on only when every event is: a half-ticked list is
  // not "on", and the first click from there should complete the set rather than
  // clear the few that were chosen.
  const allEvents = syncEvents.length === AUTO_SYNC_EVENTS.length;
  const toggleAllEvents = (on: boolean) => setSyncEvents(on ? AUTO_SYNC_EVENTS.map((e) => e.id) : []);

  const onSave = () => {
    if (!canSave) {
      return;
    }
    saveSettings({
      hoursPerDay: parsedHours,
      weekStart: week,
      todosPerPage: parsedTodoPage,
      autoSync: { enabled: syncEnabled, delayMinutes: parsedDelay, events: syncEvents },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="max-w-[920px] mx-auto">
        <div className="mb-8">
          <h1 className="text-[24px] font-bold m-0">Settings</h1>
          <p className="text-control text-neutral-675 mt-1 mb-0">
            App configuration, stored in <code className="text-meta bg-neutral-250 rounded-chip px-[5px] py-[1px]">.worklog/config.json</code> in this repository.
          </p>
        </div>

        <Card className="divide-y divide-neutral-250">
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
              {/* Not a `<label htmlFor>` like the rows above: clicking a label
                  forwards its click to the control, and a switch flipping because
                  you clicked anywhere in this paragraph is not what a reader
                  means. The `Toggle` carries its own name instead. */}
              <div className="text-row font-semibold">Automatic Git sync</div>
              <div className="text-control text-neutral-675 mt-[3px]">
                Commit and push in the background a while after your last change, so your timesheet doesn’t sit unpushed. Only errors are shown.
              </div>
            </div>
            <Toggle checked={syncEnabled} onChange={setSyncEnabled} aria-label="Automatic Git sync" />
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
                <span className="text-control text-neutral-675">min</span>
              </div>
            </SettingRow>
          )}

          <div className="px-[18px] py-[18px]">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-row font-semibold">Sync right away after</div>
                <div className="text-control text-neutral-675 mt-[3px]">
                  Changes of these kinds are pushed within seconds instead of waiting out the delay. They work on their
                  own — with automatic Git sync off, these are the only changes that sync by themselves.
                </div>
              </div>
              {/* A fixed name, not one that changes with the state: `aria-checked`
                  already says which way it points, and a label that reads
                  differently on each press is what makes a switch hard to follow. */}
              <Toggle checked={allEvents} onChange={toggleAllEvents} aria-label="Sync right away after every change" />
            </div>
            <div className="mt-3 divide-y divide-neutral-250 border-t border-neutral-250">
              {AUTO_SYNC_EVENTS.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-6 py-3">
                  <div>
                    {/* Same reasoning as the switch above: no `<label htmlFor>`, or
                        clicking the explanation would flip the switch. */}
                    <div className="text-control font-medium">{event.label}</div>
                    <div className="text-meta text-neutral-675 mt-[2px]">{event.description}</div>
                  </div>
                  <Toggle
                    checked={syncEvents.includes(event.id)}
                    onChange={(on) => toggleEvent(event.id, on)}
                    aria-label={`Sync right away after: ${event.label}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {!hoursValid && (
          <div className="text-control text-danger-675 mt-3">Hours per day must be greater than 0.</div>
        )}
        {!todoPageValid && (
          <div className="text-control text-danger-675 mt-3">To-dos per page must be a whole number of at least 1.</div>
        )}
        {syncEnabled && !delayValid && (
          <div className="text-control text-danger-675 mt-3">Sync delay must be a whole number of at least 1 minute.</div>
        )}

        <div className="flex items-center gap-3 mt-6">
          <Button variant="primary" size="md" onClick={onSave} disabled={!canSave}>
            Save changes
          </Button>
          {saved && <span className="text-control text-success-500 font-medium">Saved</span>}
        </div>

        <QuickCaptureSection />
      </div>
    </div>
  );
}

/** What the browser said when asked, in the app's words. Split out because the
 *  same three answers come back from both buttons, and the difference between them
 *  is one sentence. */
function protocolMessage(action: 'register' | 'unregister', result: ProtocolHandlerResult): string {
  if (result === 'refused') {
    return 'Your browser turned the request down. Handling links needs a secure (https) connection to this site.';
  }
  if (result === 'unsupported') {
    return action === 'register'
      ? 'This browser can’t handle custom links. Deeplinks still work as ordinary /app/new URLs.'
      : 'This browser has no way for a site to hand the scheme back. Remove Worklog from the handler list in your browser’s own settings.';
  }
  return action === 'register'
    ? 'Asked your browser to open these links here — confirm it in the prompt or the address bar. If nothing appeared, this browser already has an answer on file; change it in the browser’s settings.'
    : 'Asked your browser to stop opening these links here.';
}

/** Claiming `web+worklog:` for this browser. Its own section, after the save
 *  button, because nothing in it is a repository setting: it applies to this
 *  browser the moment it's asked for and is never written to config.json — which is
 *  also why it has no "unsaved changes" state and no part in `dirty`.
 *
 *  Two buttons rather than a toggle. A toggle claims to know which way things
 *  currently are, and nothing here can: the browser owns that state and offers no
 *  way to read it back. */
function QuickCaptureSection() {
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  // Read once on mount, not during render: it touches `navigator`, and this view is
  // rendered on the server too.
  const [canRelease, setCanRelease] = useState(false);
  useEffect(() => setCanRelease(canUnregisterProtocol()), []);

  const ask = (action: 'register' | 'unregister') => {
    const result = action === 'register' ? registerProtocol() : unregisterProtocol();
    setMessage({ text: protocolMessage(action, result), failed: result !== 'asked' });
  };

  return (
    <div className="mt-10">
      <h2 className="text-[18px] font-bold m-0">Quick capture</h2>
      <p className="text-control text-neutral-675 mt-1 mb-4">
        Applies to this browser, not to your repository.
      </p>

      <Card>
        <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
          <div>
            <div className="text-row font-semibold">Open worklog links in this app</div>
            <div className="text-control text-neutral-675 mt-[3px]">
              Lets anything that can open a link —{' '}
              <code className="text-meta bg-neutral-250 rounded-chip px-[5px] py-[1px]">{DEEPLINK_SCHEME}://new?title=Call%20Bob</code>{' '}
              — open the new-task form here, pre-filled. Your browser asks you to confirm, and nothing is saved until you press Save on
              the form.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canRelease && (
              <Button variant="secondary" size="md" onClick={() => ask('unregister')}>
                Unregister
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={() => ask('register')}>
              Register
            </Button>
          </div>
        </div>
      </Card>

      {/* The browser owns the answer — it prompts, and never says what was chosen —
          so this reports what was asked, not what happened. */}
      {message && (
        <div role="status" className={`text-control mt-3 ${message.failed ? 'text-danger-675' : 'text-neutral-675'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
