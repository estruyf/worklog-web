import React, { useMemo } from 'react';
import { isEventWorklogClientId } from '../../model/worklog';
import { isGeneralTodoClientId } from '../../model/todos';
import { collectOverdue } from '../../model/overdue';
import type { ClientTaskGroup } from '../model';
import { useData, useUi } from '../context';
import { useTaskListFilter } from '../hooks';
import { Card } from '../primitives';
import { navigateToView } from '../router';
import {
  clientIdOf,
  deriveClientLinks,
  deriveDayBar,
  dueOn,
  isDone,
  previousLoggedDay,
  relevantDayClientIds,
  topLevelTasks,
  workedOnDate,
} from '../utils';
import {
  ClientLinksSection,
  DayBar,
  DayCardFooter,
  DayHeader,
  DayNote,
  DoneTasksSection,
  DueTasksSection,
  LogForm,
  OpenTasksSection,
  OverdueTasksSection,
  TodoTasksSection,
  WorkedTasksSection,
} from './day-view';

/** Derives the selected day's logs, open/worked task groups and done list. */
function useDayData() {
  const { tasks, clients, allClients, colorOf, openRowsFor, logsFor, today } = useData();
  const { selectedDate } = useUi();

  const openTasks = useMemo(() => tasks.filter((t) => !isDone(t)), [tasks]);
  const dayLogs = useMemo(() => logsFor(selectedDate), [logsFor, selectedDate]);
  // Only clients that logged time on the selected day are "relevant" to it, so the
  // day view shows open tasks for those clients alone. Narrowed to that set before
  // the filter sees it, so the toolbar's counts and tag chips describe the section
  // on screen rather than every open task in the repo.
  const dayOpenTasks = useMemo(() => {
    const loggedClientIds = new Set(dayLogs.filter((l) => !isEventWorklogClientId(l.clientId)).map((l) => l.clientId));
    return openTasks.filter((t) => loggedClientIds.has(clientIdOf(t)));
  }, [openTasks, dayLogs]);
  const openFilter = useTaskListFilter(dayOpenTasks, { label: 'open tasks', resetKey: selectedDate });
  const openGroups = useMemo<ClientTaskGroup[]>(
    () =>
      clients
        .map((c) => {
          const ct = openFilter.tasks.filter((t) => clientIdOf(t) === c.id);
          return {
            id: c.id,
            name: c.name,
            color: colorOf(c.id),
            count: topLevelTasks(ct).length,
            rows: openRowsFor(ct, openFilter.expanded),
          };
        })
        .filter((g) => g.count > 0),
    [clients, openFilter.tasks, openFilter.expanded, colorOf, openRowsFor],
  );
  // Anything already past its due date on the day being viewed. Judged against
  // the selected date rather than today, so the block always reads as "late as
  // of this day" wherever you are in the calendar.
  const overdueTasks = useMemo(() => collectOverdue(tasks, selectedDate), [tasks, selectedDate]);
  const overdueRows = useMemo(() => openRowsFor(overdueTasks), [overdueTasks, openRowsFor]);
  // Open tasks due on this day — the home for anything planned ahead of time,
  // regardless of whether its client logged time that day. Recurring tasks match
  // on every day their rule lands on, not just the next one they store. Overdue
  // ones are left out: a daily task whose rule also lands today is one task, and
  // the overdue block above is the more urgent place to meet it.
  const dueTasks = useMemo(() => {
    const late = new Set(overdueTasks.map((t) => t.id));
    return tasks.filter((t) => !isDone(t) && !late.has(t.id) && dueOn(t, selectedDate));
  }, [tasks, selectedDate, overdueTasks]);
  const dueRows = useMemo(() => openRowsFor(dueTasks), [dueTasks, openRowsFor]);
  // General to-dos (not linked to any client): a persistent personal list, shown
  // regardless of logged time or the selected date.
  const todoRows = useMemo(
    () => openRowsFor(openTasks.filter((t) => isGeneralTodoClientId(clientIdOf(t)))),
    [openTasks, openRowsFor],
  );
  const doneTasks = useMemo(() => tasks.filter((t) => t.completed === selectedDate), [tasks, selectedDate]);
  // Filtered before it is bucketed, so a client whose tasks all fall out of the
  // filter drops its card instead of leaving an empty one behind. The date keys
  // the reset: yesterday's filter has nothing to say about today's work.
  const workedTasks = useMemo(
    () => tasks.filter((t) => !isDone(t) && workedOnDate(t, selectedDate)),
    [tasks, selectedDate],
  );
  const workedFilter = useTaskListFilter(workedTasks, { label: 'worked tasks', resetKey: selectedDate });
  const workedGroups = useMemo<ClientTaskGroup[]>(
    () =>
      clients
        .map((c) => {
          const ct = workedFilter.tasks.filter((t) => clientIdOf(t) === c.id);
          return {
            id: c.id,
            name: c.name,
            color: colorOf(c.id),
            count: topLevelTasks(ct).length,
            rows: openRowsFor(ct, workedFilter.expanded),
          };
        })
        .filter((g) => g.count > 0),
    [workedFilter.tasks, workedFilter.expanded, clients, colorOf, openRowsFor],
  );

  // The clients the day is about, and where their things live. Derived from what
  // the day's sections actually put on screen rather than from the whole client
  // list, so the panel answers "the work in front of me" instead of turning into
  // a second bookmarks bar that reads the same on every date.
  const linkGroups = useMemo(
    () =>
      deriveClientLinks(
        allClients,
        relevantDayClientIds(dayLogs, [...overdueTasks, ...dueTasks, ...workedTasks, ...doneTasks]),
        colorOf,
      ),
    [allClients, dayLogs, overdueTasks, dueTasks, workedTasks, doneTasks, colorOf],
  );

  return {
    openTasks,
    dayLogs,
    overdueRows,
    dueRows,
    todoRows,
    linkGroups,
    openGroups,
    openFilter,
    doneTasks,
    workedGroups,
    workedFilter,
    isTodaySel: selectedDate === today,
  };
}

export function DayView() {
  const { today, worklog, clients, allClients, colorOf, clientName, statusMeta, reopen, openDetail, typeLabel, hoursPerDay, todosPerPage, logState, setLogState, saveLog, removeLog, closeLogForm, editLog, openLogForm, copyDayLogs, openTaskFormForDue, dayNoteDirty, saveDayNote, saveDayNoteText, editDayNote, cancelDayNote, hasDayNote } = useData();
  const { selectedDate, setSelectedDate, setSelectedClient, setShowArchivedClients, editDayOpen, setEditDayOpen, dayNoteDraft, setDayNoteDraft, dayNoteMode, setDayNoteMode, dayNoteSavedAt } = useUi();
  const {
    openTasks,
    dayLogs,
    overdueRows,
    dueRows,
    todoRows,
    linkGroups,
    openGroups,
    openFilter,
    doneTasks,
    workedGroups,
    workedFilter,
    isTodaySel,
  } = useDayData();
  const onSelectDate = setSelectedDate;
  // Select-then-navigate, the same shape the calendar uses to open a day. The
  // day can surface a client that has since been archived, so unfold the
  // archived list too — otherwise the rail lands on a selection it doesn't show.
  const openClient = (clientId: string) => {
    if (allClients.find((c) => c.id === clientId)?.archived) {
      setShowArchivedClients(true);
    }
    setSelectedClient(clientId);
    navigateToView('clients');
  };
  // New time goes to active clients only, but editing an entry logged before its
  // client was archived still shows (and keeps) that client.
  const logClients = useMemo(() => {
    const current = allClients.find((c) => c.id === logState.client);
    return current?.archived ? [...clients, current] : clients;
  }, [clients, allClients, logState.client]);
  const openTasksCount = openTasks.length;
  const isFuture = selectedDate > today;
  // The day bar's geometry: one segment per entry, plus whatever is left of the
  // working day. Over-logging is allowed — the bar grows past the target and says
  // so rather than the editor refusing the hours.
  const bar = useMemo(() => deriveDayBar(dayLogs, hoursPerDay), [dayLogs, hoursPerDay]);
  // Offered on an empty day only, so the one-click path can never overwrite what
  // is already there.
  const copyFrom = useMemo(
    () => (dayLogs.length === 0 ? previousLoggedDay(worklog, selectedDate) : undefined),
    [dayLogs.length, worklog, selectedDate],
  );
  // Clicking the segment the form is already on closes it: the segment is the
  // entry, so it is the same control either way.
  const onEditLog = (clientId: string) =>
    logState.open && logState.editingClientId === clientId ? closeLogForm() : editLog(clientId);

  return (
    // The header is the band; everything below it scrolls under it.
    <div className="flex flex-1 flex-col min-h-0">
      <DayHeader
        selectedDate={selectedDate}
        today={today}
        isTodaySel={isTodaySel}
        editDayOpen={editDayOpen}
        setEditDayOpen={setEditDayOpen}
        onSelectDate={onSelectDate}
        isFuture={isFuture}
        openTaskFormForDue={openTaskFormForDue}
      />

      <div className="flex-1 overflow-auto px-6 pt-6 pb-20">
        {/* The main column keeps its comfortable reading width; the extra room from
         * `xl:` up goes to the to-do side list, so a long to-do list never pushes
         * the logged time and client sections down the page. */}
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {/* The side panel is placed by the grid, not duplicated. From `xl:` up it is
            * one sticky column beside the main one, spanning all three of its rows.
            * Below that it is `display: contents` — its own box disappears, so Links
            * and To-dos become items of the single-column stack and `order` can put
            * each where it belongs on a phone: the day first, its clients' links
            * right under it, and the standing to-do list last. One Links node can't
            * be in the middle of the stack *and* in the side column any other way.
            *
            * It sticks at `top-0`, not at an inset: any offset here is a gap the
            * panel opens between itself and the top of the day the moment you
            * scroll, which reads as the side column starting lower than the main
            * one. The scroll area's own `pt-6` is the breathing room. */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-x-8">
            <div className="min-w-0 order-1 xl:col-start-1 xl:row-start-1">
              <OverdueTasksSection overdueRows={overdueRows} />
              <DueTasksSection dueRows={dueRows} />
            </div>

            <aside className="contents xl:block xl:col-start-2 xl:row-start-1 xl:row-end-4 xl:self-start xl:sticky xl:top-0">
              <div className="min-w-0 order-3">
                <ClientLinksSection groups={linkGroups} onOpenClient={openClient} />
              </div>
              <div className="min-w-0 order-5 hidden md:block mt-9">
                <TodoTasksSection todoRows={todoRows} pageSize={todosPerPage} />
              </div>
            </aside>

            <div className="min-w-0 order-2 xl:col-start-1 xl:row-start-2">
              {/* The day is one card: the bar, the form for whichever slice of it
                * you clicked, whatever was written about it, and a footer holding
                * the two verbs that apply to the day rather than to a segment. */}
              <Card padding="md" className="mb-[34px]">
                <DayBar
                  bar={bar}
                  selectedDate={selectedDate}
                  clientName={clientName}
                  colorOf={colorOf}
                  typeLabel={typeLabel}
                  activeClientId={logState.open ? logState.editingClientId : ''}
                  editLog={onEditLog}
                  logTime={openLogForm}
                  copyFrom={copyFrom}
                  copyDay={copyDayLogs}
                />

                {logState.open && (
                  <LogForm
                    logState={logState}
                    setLogState={setLogState}
                    saveLog={saveLog}
                    removeLog={removeLog}
                    close={closeLogForm}
                    clients={logClients}
                    colorOf={colorOf}
                  />
                )}

                <DayNote
                  value={dayNoteDraft}
                  onChange={setDayNoteDraft}
                  mode={dayNoteMode}
                  onModeChange={setDayNoteMode}
                  dirty={dayNoteDirty}
                  onSave={saveDayNote}
                  onCancel={cancelDayNote}
                  onToggleTask={saveDayNoteText}
                />

                <DayCardFooter
                  onLogTime={openLogForm}
                  onEditNote={editDayNote}
                  hasNote={hasDayNote}
                  editingNote={dayNoteMode === 'edit'}
                  noteSavedAt={dayNoteSavedAt}
                />
              </Card>
            </div>

            <div className="min-w-0 order-4 xl:col-start-1 xl:row-start-3">
              <OpenTasksSection
                isTodaySel={isTodaySel}
                editDayOpen={editDayOpen}
                openGroups={openGroups}
                openFilter={openFilter}
                dayLogs={dayLogs}
                openTasksCount={openTasksCount}
              />

              <WorkedTasksSection isTodaySel={isTodaySel} workedGroups={workedGroups} filter={workedFilter} />

              <DoneTasksSection
                doneTasks={doneTasks}
                isTodaySel={isTodaySel}
                reopen={reopen}
                openDetail={openDetail}
                statusMeta={statusMeta}
                clientName={clientName}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
