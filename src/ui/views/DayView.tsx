import React, { useMemo } from 'react';
import { isEventWorklogClientId } from '../../model/worklog';
import { isGeneralTodoClientId } from '../../model/todos';
import { collectOverdue } from '../../model/overdue';
import type { ClientTaskGroup } from '../model';
import { useData, useUi } from '../context';
import { useTaskListFilter } from '../hooks';
import { clientIdOf, dueOn, isDone, workedOnDate } from '../utils';
import {
  DayHeader,
  DoneTasksSection,
  DueTasksSection,
  LoggedSection,
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
  const { today, clients, allClients, colorOf, clientName, statusMeta, reopen, openDetail, typeLabel, hoursPerDay, todosPerPage, logState, setLogState, saveLog, removeLog, editLog, openLogForm, openTaskFormForDue } = useData();
  const { selectedDate, setSelectedDate, editDayOpen, setEditDayOpen } = useUi();
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
  // Day rollup for the LOGGED pill: total hours and the derived days.
  const loggedHours = dayLogs.reduce((sum, l) => sum + l.hours, 0);
  const loggedDays = hoursPerDay ? Math.round((loggedHours / hoursPerDay) * 100) / 100 : 0;

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
            <LoggedSection
              dayLogs={dayLogs}
              loggedHours={loggedHours}
              loggedDays={loggedDays}
              colorOf={colorOf}
              clientName={clientName}
              typeLabel={typeLabel}
              editLog={editLog}
              openLogForm={openLogForm}
            />

            {logState.open && (
              <LogForm
                logState={logState}
                setLogState={setLogState}
                saveLog={saveLog}
                removeLog={removeLog}
                clients={logClients}
                colorOf={colorOf}
              />
            )}

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
