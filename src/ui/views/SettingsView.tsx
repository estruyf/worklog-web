import React, { useEffect, useId, useState } from 'react';
import { Button, Card, Input, SectionLabel, Select, Toggle, ViewHeader } from '../primitives';
import { AGENT_ICONS, StatusSettings } from '../components';
import { useData, useUi } from '../context';
import { setNavGuard } from '../router';
import { worklogStore } from '../../data/worklogStore';
import { AI_AGENTS, COMMAND_EXECUTOR_MIN_VERSION, COMMAND_EXECUTOR_URL, type AiAgent } from '../../model/aiAgents';
import { AUTO_SYNC_EVENTS, type AutoSyncEvent } from '../../model/syncEvents';
import { sortDirectionLabels, TASK_SORTS, type TaskSortDirection, type TaskSortKey } from '../utils';

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
 *  settings not managed elsewhere (clients live in the Clients view), plus the
 *  task-status list, which manages itself — see `StatusSettings`. */
export function SettingsView() {
  const { hoursPerDay, weekStart, todosPerPage, defaultTaskSort, autoSync, features, aiAgents, saveSettings } = useData();
  const { ask } = useUi().confirm;

  const [hours, setHours] = useState(String(hoursPerDay));
  const [week, setWeek] = useState(weekStart);
  const [todoPage, setTodoPage] = useState(String(todosPerPage));
  const [sortKey, setSortKey] = useState<TaskSortKey>(defaultTaskSort.key);
  const [sortDir, setSortDir] = useState<TaskSortDirection>(defaultTaskSort.dir);
  const [attachmentsOn, setAttachmentsOn] = useState(features.attachments);
  const [promptsOn, setPromptsOn] = useState(features.prompts);
  const [syncEnabled, setSyncEnabled] = useState(autoSync.enabled);
  const [syncDelay, setSyncDelay] = useState(String(autoSync.delayMinutes));
  const [syncEvents, setSyncEvents] = useState<AutoSyncEvent[]>(autoSync.events);
  const [agents, setAgents] = useState<AiAgent[]>(aiAgents);
  const ids = useId();

  // The saved event list as a value, not a reference: `autoSync` is rebuilt from
  // config.json on every derive, so its `events` array is a fresh object each time
  // and depending on it would re-seed — discarding what's half-ticked here — on any
  // unrelated edit. The order is canonical (see parseAutoSyncEvents), so this is
  // stable for as long as the setting is.
  const savedEvents = autoSync.events.join(',');
  // Same reason as `savedEvents`: the list is rebuilt from config.json on every
  // derive, and `parseAiAgents` makes its order canonical, so comparing the joined
  // string is stable for as long as the setting is.
  const savedAgents = aiAgents.join(',');

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
  // Two effects, not one on `defaultTaskSort`: it is rebuilt on every derive, so
  // the object identity changes on any unrelated edit and would re-seed a
  // half-made choice back to what is saved.
  useEffect(() => {
    setSortKey(defaultTaskSort.key);
  }, [defaultTaskSort.key]);
  useEffect(() => {
    setSortDir(defaultTaskSort.dir);
  }, [defaultTaskSort.dir]);
  // On the two booleans rather than on `features`, for the reason the sort pair
  // is split above: the block is rebuilt on every derive.
  useEffect(() => {
    setAttachmentsOn(features.attachments);
  }, [features.attachments]);
  useEffect(() => {
    setPromptsOn(features.prompts);
  }, [features.prompts]);
  useEffect(() => {
    setSyncEnabled(autoSync.enabled);
  }, [autoSync.enabled]);
  useEffect(() => {
    setSyncDelay(String(autoSync.delayMinutes));
  }, [autoSync.delayMinutes]);
  useEffect(() => {
    setSyncEvents(savedEvents ? (savedEvents.split(',') as AutoSyncEvent[]) : []);
  }, [savedEvents]);
  useEffect(() => {
    setAgents(savedAgents ? (savedAgents.split(',') as AiAgent[]) : []);
  }, [savedAgents]);

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
    sortKey !== defaultTaskSort.key ||
    sortDir !== defaultTaskSort.dir ||
    attachmentsOn !== features.attachments ||
    promptsOn !== features.prompts ||
    syncEnabled !== autoSync.enabled ||
    (delayValid && parsedDelay !== autoSync.delayMinutes) ||
    syncEvents.join(',') !== savedEvents ||
    agents.join(',') !== savedAgents;

  const invalid = !hoursValid || !todoPageValid || (syncEnabled && !delayValid);
  const canSave = dirty && !invalid;

  // While the draft deviates from config.json, every way off this view — the nav
  // rail, a shortcut, browser Back, even switching repo or signing out — goes
  // through this question first. Registered on `dirty` alone: an invalid value
  // with nothing else changed holds nothing worth keeping. Saving or discarding
  // flips `dirty` back and the cleanup stands the guard down.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    setNavGuard(() =>
      ask({
        title: 'Leave Settings without saving?',
        message: 'Your changes here haven’t been saved and will be lost.',
        confirmLabel: 'Discard and leave',
        tone: 'danger',
      }),
    );
    return () => setNavGuard(null);
  }, [dirty, ask]);

  // The browser-level counterpart, for reload and tab close, where the router
  // never gets a say. Same shape as `useUnsavedGuard`, which covers saved-but-
  // unsynced edits; this draft exists only in component state, so it gets its own.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /** Tick an event on or off, keeping the list in the canonical order so saving
   *  the same set twice writes the same config.json. */
  const toggleEvent = (id: AutoSyncEvent, on: boolean) => {
    setSyncEvents(AUTO_SYNC_EVENTS.filter((e) => (e.id === id ? on : syncEvents.includes(e.id))).map((e) => e.id));
  };

  // The all-switch reads as on only when every event is: a half-ticked list is
  // not "on", and the first click from there should complete the set rather than
  // clear the few that were chosen.
  // "Oldest first" on a date column, "A → Z" on a title: the direction options
  // are named after the sort they apply to, since asc/desc says nothing here.
  const sortDirLabels = sortDirectionLabels(sortKey);

  const allEvents = syncEvents.length === AUTO_SYNC_EVENTS.length;
  const toggleAllEvents = (on: boolean) => setSyncEvents(on ? AUTO_SYNC_EVENTS.map((e) => e.id) : []);

  /** Same canonical-order rule as `toggleEvent`, and for the same reason: saving
   *  the same set of agents twice should write the same config.json. */
  const toggleAgent = (id: AiAgent, on: boolean) => {
    setAgents(AI_AGENTS.filter((a) => (a.id === id ? on : agents.includes(a.id))).map((a) => a.id));
  };

  const onSave = () => {
    if (!canSave) {
      return;
    }
    saveSettings({
      hoursPerDay: parsedHours,
      weekStart: week,
      todosPerPage: parsedTodoPage,
      defaultTaskSort: { key: sortKey, dir: sortDir },
      features: { attachments: attachmentsOn, prompts: promptsOn },
      autoSync: { enabled: syncEnabled, delayMinutes: parsedDelay, events: syncEvents },
      aiAgents: agents,
    });
    // Saving empties the draft, so the footer that held the confirmation is about
    // to disappear — the toast is what says the click landed.
    worklogStore.notify({ message: 'Settings saved', tone: 'success' });
  };

  /** Back to what config.json holds — the same re-seed the snapshot effects do,
   *  taken up on purpose instead of by navigating away. */
  const onDiscard = () => {
    setHours(String(hoursPerDay));
    setWeek(weekStart);
    setTodoPage(String(todosPerPage));
    setSortKey(defaultTaskSort.key);
    setSortDir(defaultTaskSort.dir);
    setAttachmentsOn(features.attachments);
    setPromptsOn(features.prompts);
    setSyncEnabled(autoSync.enabled);
    setSyncDelay(String(autoSync.delayMinutes));
    setSyncEvents(savedEvents ? (savedEvents.split(',') as AutoSyncEvent[]) : []);
    setAgents(savedAgents ? (savedAgents.split(',') as AiAgent[]) : []);
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Only the title is in the band: the line about where this is stored is
          context for the settings, and belongs with them. */}
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px]">
        <h1 className="text-[24px] font-bold m-0">Settings</h1>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          <p className="text-control text-neutral-675 mt-0 mb-6">
            App configuration, stored in <code className="text-meta bg-neutral-250 rounded-chip px-[5px] py-[1px]">.worklog/config.json</code> in this repository.
          </p>

          {/* Two labelled cards rather than one long one: "Settings → Sync" is
              how the README (and a person) refers to the second half, and a flat
              list of unrelated levers is what made it unfindable. */}
          <SectionLabel className="mb-[10px]">General</SectionLabel>
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

            <SettingRow
              id={`${ids}-sort`}
              title="Default task order"
              description="How open-task lists are ordered when you open them, and what their Reset returns to. A list’s own sort picker overrides this until you reload."
            >
              <div className="flex gap-2 shrink-0">
                <Select
                  id={`${ids}-sort`}
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as TaskSortKey)}
                  className="w-[130px]"
                >
                  {TASK_SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Default task order direction"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as TaskSortDirection)}
                  className="w-[150px]"
                >
                  <option value="asc">{sortDirLabels.asc}</option>
                  <option value="desc">{sortDirLabels.desc}</option>
                </Select>
              </div>
            </SettingRow>
          </Card>

          {/* The blocks a task can carry beyond its description. Switching one
              off is about what this repo is for — a timesheet that never takes
              files, a workflow with no prompts in it — so it sits on its own
              rather than among the numbers above. */}
          <SectionLabel className="mt-6 mb-[10px]">Task content</SectionLabel>
          <Card className="divide-y divide-neutral-250">
            {/* Same shape as the sync switch below, and not a `<label htmlFor>`,
                for the same reason: a switch that flips because you clicked its
                explanation is not what a reader means. */}
            <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
              <div>
                <div className="text-row font-semibold">Attachments</div>
                <div className="text-control text-neutral-675 mt-[3px]">
                  Files stored in <code className="text-meta bg-neutral-250 rounded-chip px-[5px] py-[1px]">assets/</code> and recorded on a task. Off hides the action and the list;
                  files already attached stay in your Markdown. Images pasted into a description or a note are unaffected — those are Markdown, not attachments.
                </div>
              </div>
              <Toggle checked={attachmentsOn} onChange={setAttachmentsOn} aria-label="Attachments" />
            </div>

            <div className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
              <div>
                <div className="text-row font-semibold">Prompts</div>
                <div className="text-control text-neutral-675 mt-[3px]">
                  The queue of prompts to run against a task later, ticked off once you have. Off hides the action and the queue; the prompts already written stay in your Markdown.
                </div>
              </div>
              <Toggle checked={promptsOn} onChange={setPromptsOn} aria-label="Prompts" />
            </div>
          </Card>

          <SectionLabel className="mt-6 mb-[10px]">Sync</SectionLabel>
          <Card className="divide-y divide-neutral-250">
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

          {/* Its own section rather than another row in the card above: these
              don't configure the app, they add something to every task, and the
              extension they need is a prerequisite rather than a footnote. */}
          <div className="mt-6">
            <SectionLabel className="mb-[10px]">AI agents</SectionLabel>
            <Card className="divide-y divide-neutral-250">
              <div className="px-[18px] py-[18px]">
                <p className="text-control text-neutral-675 m-0">
                  Hand a task to an agent from its Actions list: the title and description open as a prompt in VS Code.
                  This needs the{' '}
                  <a
                    href={COMMAND_EXECUTOR_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-info hover:underline"
                  >
                    Command Executor
                  </a>{' '}
                  extension, {COMMAND_EXECUTOR_MIN_VERSION} or newer — a{' '}
                  <code className="text-meta bg-neutral-250 rounded-chip px-[5px] py-[1px]">vscode://</code> link can’t
                  run a command on its own. Nothing is sent: the prompt lands in the agent’s input for you to read,
                  change and send yourself.
                </p>
              </div>
              {AI_AGENTS.map((agent) => {
                const AgentIcon = AGENT_ICONS[agent.id];
                return (
                  <div key={agent.id} className="flex items-start justify-between gap-6 px-[18px] py-[18px]">
                    <div>
                      {/* No `<label htmlFor>`, same as the switches above: clicking
                          the explanation shouldn't flip anything. */}
                      <div className="flex items-center gap-[8px] text-row font-semibold">
                        {/* The mark sits with the name rather than out at the row's
                            edge: it identifies which agent this is, and the switch
                            on the right is the row's only control. */}
                        <AgentIcon size={16} />
                        {agent.label}
                      </div>
                      <div className="text-control text-neutral-675 mt-[3px]">{agent.description}</div>
                    </div>
                    <Toggle
                      checked={agents.includes(agent.id)}
                      onChange={(on) => toggleAgent(agent.id, on)}
                      aria-label={`Offer ${agent.label} on tasks`}
                    />
                  </div>
                );
              })}
            </Card>
          </div>

          {/* Last, after the drafted settings: the status editor writes as you
              go and has no part in the draft the footer bar saves. */}
          <StatusSettings />
        </div>
      </div>

      {/* Outside the scroll area, so the way to keep (or drop) a half-made draft
          is on screen wherever the edit happened — the old Save sat at the bottom
          of a page long enough to scroll it out of sight, and navigating away
          discarded everything without a word. */}
      {(dirty || invalid) && (
        <div className="border-t border-neutral-250 bg-white px-6 py-3">
          <div className="max-w-[920px] xl:max-w-[1280px] mx-auto flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] text-control">
              {!hoursValid ? (
                <span className="text-danger-675">Hours per day must be greater than 0.</span>
              ) : !todoPageValid ? (
                <span className="text-danger-675">To-dos per page must be a whole number of at least 1.</span>
              ) : syncEnabled && !delayValid ? (
                <span className="text-danger-675">Sync delay must be a whole number of at least 1 minute.</span>
              ) : (
                <span className="text-neutral-675">Unsaved changes</span>
              )}
            </div>
            <Button variant="secondary" size="md" onClick={onDiscard}>
              Discard
            </Button>
            <Button variant="primary" size="md" onClick={onSave} disabled={!canSave}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

