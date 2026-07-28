import React, { useMemo } from 'react';
import { isEventWorklogClientId } from '../../model/worklog';
import { isGeneralTodoClientId } from '../../model/todos';
import type { ClientTaskGroup } from '../model';
import { useData, useUi } from '../context';
import { clientIdOf, isDone, workedOnDate } from '../utils';
import {
  DayHeader,
  DoneTasksSection,
  DueTasksSection,
  LoggedSection,
  LogForm,
  OpenTasksSection,
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
  // day view shows open tasks for those clients alone.
  const openGroups = useMemo<ClientTaskGroup[]>(() => {
    const loggedClientIds = new Set(dayLogs.filter((l) => !isEventWorklogClientId(l.clientId)).map((l) => l.clientId));
    return clients
      .map((c) => {
        const ct = openTasks.filter((t) => clientIdOf(t) === c.id);
        return { id: c.id, name: c.name, color: colorOf(c.id), count: ct.length, rows: openRowsFor(ct) };
      })
      .filter((g) => g.count > 0 && loggedClientIds.has(g.id));
  }, [clients, openTasks, dayLogs, colorOf, openRowsFor]);
  // Open tasks due on this day — the home for anything planned ahead of time,
  // regardless of whether its client logged time that day.
  const dueRows = useMemo(
    () => openRowsFor(tasks.filter((t) => !isDone(t) && t.due === selectedDate)),
    [tasks, selectedDate, openRowsFor],
  );
  // General to-dos (not linked to any client): a persistent personal list, shown
  // regardless of logged time or the selected date.
  const todoRows = useMemo(
    () => openRowsFor(openTasks.filter((t) => isGeneralTodoClientId(clientIdOf(t)))),
    [openTasks, openRowsFor],
  );
  const doneTasks = useMemo(() => tasks.filter((t) => t.completed === selectedDate), [tasks, selectedDate]);
  const workedGroups = useMemo<ClientTaskGroup[]>(() => {
    const workedTasks = tasks.filter((t) => !isDone(t) && workedOnDate(t, selectedDate));
    return clients
      .map((c) => {
        const ct = workedTasks.filter((t) => clientIdOf(t) === c.id);
        return { id: c.id, name: c.name, color: colorOf(c.id), count: ct.length, rows: openRowsFor(ct) };
      })
      .filter((g) => g.count > 0);
  }, [tasks, selectedDate, clients, colorOf, openRowsFor]);

  return { openTasks, dayLogs, dueRows, todoRows, openGroups, doneTasks, workedGroups, isTodaySel: selectedDate === today };
}

export function DayView() {
  const { today, clients, allClients, colorOf, clientName, statusMeta, reopen, openDetail, typeLabel, hoursPerDay, todosPerPage, logState, setLogState, saveLog, removeLog, editLog, openLogForm, openModalForDue } = useData();
  const { selectedDate, setSelectedDate, editDayOpen, setEditDayOpen } = useUi();
  const { openTasks, dayLogs, dueRows, todoRows, openGroups, doneTasks, workedGroups, isTodaySel } = useDayData();
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
          openModalForDue={openModalForDue}
        />

        {/* The to-do panel is placed by the grid, not duplicated: it stacks in the
          * flow under the due tasks on narrow screens, and moves into a sticky
          * second column from `xl:` up, spanning both rows of the main column. */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-x-8">
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
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
              dayLogs={dayLogs}
              openTasksCount={openTasksCount}
            />

            <WorkedTasksSection isTodaySel={isTodaySel} workedGroups={workedGroups} />

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
