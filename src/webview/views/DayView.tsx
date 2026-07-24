import React, { useMemo } from 'react';
import { isEventWorklogClientId } from '../../model/worklog';
import { ClientTaskGroup } from '../model';
import { useData, useUi } from '../context';
import { clientIdOf, isDone, workedOnDate } from '../utils';
import {
  DayHeader,
  DoneTasksSection,
  DueTasksSection,
  LoggedSection,
  LogForm,
  OpenTasksSection,
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

  return { openTasks, dayLogs, dueRows, openGroups, doneTasks, workedGroups, isTodaySel: selectedDate === today };
}

export function DayView() {
  const { today, clients, colorOf, clientName, statusMeta, reopen, openDetail, typeLabel, hoursPerDay, logState, setLogState, saveLog, removeLog, editLog, openLogForm, openModalForDue } = useData();
  const { selectedDate, setSelectedDate, editDayOpen, setEditDayOpen } = useUi();
  const { openTasks, dayLogs, dueRows, openGroups, doneTasks, workedGroups, isTodaySel } = useDayData();
  const onSelectDate = setSelectedDate;
  const openTasksCount = openTasks.length;
  const isFuture = selectedDate > today;
  // Day rollup for the LOGGED pill: total hours and the derived days.
  const loggedHours = dayLogs.reduce((sum, l) => sum + l.hours, 0);
  const loggedDays = hoursPerDay ? Math.round((loggedHours / hoursPerDay) * 100) / 100 : 0;

  return (
    <div className="flex-1 overflow-auto px-6 pt-8 pb-20">
      <div className="max-w-[920px] mx-auto">
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

        <DueTasksSection dueRows={dueRows} />

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
            clients={clients}
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
  );
}
