import React, { useMemo } from 'react';
import { isEventWorklogClientId } from '../../model/worklog';
import { isGeneralTodoClientId } from '../../model/todos';
import { collectOverdue } from '../../model/overdue';
import type { ClientTaskGroup } from '../model';
import { useData, useUi } from '../context';
import { useTaskListFilter } from '../hooks';
import { Card } from '../primitives';
import { clientIdOf, deriveDayBar, dueOn, isDone, previousLoggedDay, workedOnDate } from '../utils';
import {
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
  const { tasks, clients, colorOf, openRowsFor, logsFor, today } = useData();
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
          return { id: c.id, name: c.name, color: colorOf(c.id), count: ct.length, rows: openRowsFor(ct) };
        })
        .filter((g) => g.count > 0),
    [clients, openFilter.tasks, colorOf, openRowsFor],
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
  const dueRows = useMemo(() => {
    const late = new Set(overdueTasks.map((t) => t.id));
    return openRowsFor(tasks.filter((t) => !isDone(t) && !late.has(t.id) && dueOn(t, selectedDate)));
  }, [tasks, selectedDate, openRowsFor, overdueTasks]);
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
          return { id: c.id, name: c.name, color: colorOf(c.id), count: ct.length, rows: openRowsFor(ct) };
        })
        .filter((g) => g.count > 0),
    [workedFilter.tasks, clients, colorOf, openRowsFor],
  );

  return {
    openTasks,
    dayLogs,
    overdueRows,
    dueRows,
    todoRows,
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
  const { selectedDate, setSelectedDate, editDayOpen, setEditDayOpen, dayNoteDraft, setDayNoteDraft, dayNoteMode, setDayNoteMode, dayNoteSavedAt } = useUi();
  const {
    openTasks,
    dayLogs,
    overdueRows,
    dueRows,
    todoRows,
    openGroups,
    openFilter,
    doneTasks,
    workedGroups,
    workedFilter,
    isTodaySel,
  } = useDayData();
  const onSelectDate = setSelectedDate;
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
    <div className="flex-1 overflow-auto px-6 pt-8 pb-20">
      {/* The main column keeps its comfortable reading width; the extra room from
       * `xl:` up goes to the to-do side list, so a long to-do list never pushes
       * the logged time and client sections down the page. */}
      <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
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

        {/* The to-do panel is placed by the grid, not duplicated: it stacks in the
          * flow under the due tasks on narrow screens, and moves into a sticky
          * second column from `xl:` up, spanning both rows of the main column. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-x-8">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <OverdueTasksSection overdueRows={overdueRows} />
            <DueTasksSection dueRows={dueRows} />
          </div>

          <aside className="min-w-0 xl:col-start-2 xl:row-start-1 xl:row-end-3 xl:self-start xl:sticky xl:top-0">
            <TodoTasksSection todoRows={todoRows} pageSize={todosPerPage} />
          </aside>

          <div className="min-w-0 xl:col-start-1 xl:row-start-2">
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
  );
}
