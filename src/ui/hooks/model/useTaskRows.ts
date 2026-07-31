// Turning a task into the row every list in the app renders, with its actions
// pre-bound. `WorklogRow` is the one shape WorklogTaskRow knows about, so this is
// where "a task" becomes "a line on screen".

import { useCallback } from "react";
import type { Task } from "../../../model/types";
import { isGeneralTodoClientId } from "../../../model/todos";
import { describeRecurrence } from "../../../model/recurrence";
import { daysSinceEpoch } from "../../../util/date";
import { navigateToTask } from "../../router";
import type { StatusMetaFn, WorklogRow } from "../../model";
import { clientIdOf, dueOn, isDone, linksOf, workedOnDate } from "../../utils";

/** Everything a row needs that isn't the task itself: the day it is shown on, and
 *  the actions its buttons fire. */
export interface TaskRowDeps {
  tasks: Task[];
  today: string;
  selectedDate: string;
  statusMeta: StatusMetaFn;
  cycleStatus: (t: Task) => void;
  openTagSearch: (tag: string) => void;
  openDetail: (t: Task) => void;
  markDone: (t: Task) => void;
  toggleWorked: (t: Task) => void;
  openEdit: (t: Task) => void;
  deleteTask: (id: string, options?: { permanent?: boolean }) => void;
}

export function useTaskRows(deps: TaskRowDeps) {
  const {
    tasks,
    today,
    selectedDate,
    statusMeta,
    cycleStatus,
    openTagSearch,
    openDetail,
    markDone,
    toggleWorked,
    openEdit,
    deleteTask,
  } = deps;

  const makeRow = useCallback(
    (t: Task, child: boolean): WorklogRow => {
      const ls = linksOf(t);
      // General to-dos are open or closed only: no worked-on marking and no
      // status to show or cycle through.
      const todo = isGeneralTodoClientId(clientIdOf(t));
      const m = todo ? undefined : statusMeta(t.status, isDone(t));
      const worked = !todo && workedOnDate(t, selectedDate);
      const children = tasks.filter((c) => c.parentId === t.id);
      const progress = children.length ? { done: children.filter(isDone).length, total: children.length } : undefined;
      // On a day the rule lands on, the chip shows *that* occurrence — a
      // recurring task only stores its next due date, so showing it raw would
      // label a September occurrence with an August date.
      const displayDue = t.repeat && !isDone(t) && dueOn(t, selectedDate) ? selectedDate : t.due;
      // Overdue is judged on the occurrence being shown, not on the stored due
      // date: a daily task that also lands on the day you're looking at is due
      // then, not late, however far back its stored `due` sits.
      const overdue = !!displayDue && !isDone(t) && displayDue < today;
      return {
        id: t.id,
        title: t.title,
        pad: child ? "40px" : "10px",
        statusLabel: m?.label,
        statusColor: m?.color,
        worked,
        workedTitle: worked ? "Unmark worked on this day" : "Mark worked on this day",
        hasLink: ls.length > 0,
        link: ls[0] || "",
        due: displayDue,
        overdue,
        overdueDays: overdue ? daysSinceEpoch(today) - daysSinceEpoch(displayDue as string) : undefined,
        repeat: t.repeat && !isDone(t) ? describeRecurrence(t.repeat) : undefined,
        tags: t.tags ?? [],
        progress,
        onView: () => openDetail(t),
        onOpenTab: () => navigateToTask(t.id),
        onDone: () => markDone(t),
        onWorked: todo ? undefined : () => toggleWorked(t),
        onCycle: todo ? undefined : () => cycleStatus(t),
        onEdit: () => openEdit(t),
        onDelete: () => deleteTask(t.id),
        onTagClick: openTagSearch,
      };
    },
    [statusMeta, selectedDate, tasks, today, openDetail, markDone, toggleWorked, cycleStatus, openEdit, deleteTask, openTagSearch],
  );

  /** A flat list of rows with subtasks indented under their parent, and orphaned
   *  subtasks (whose parent isn't in `list`) shown at top level. */
  const openRowsFor = useCallback(
    (list: Task[]): WorklogRow[] => {
      const rows: WorklogRow[] = [];
      const tops = list.filter((t) => !t.parentId);
      tops.forEach((t) => {
        rows.push(makeRow(t, false));
        list.filter((c) => c.parentId === t.id).forEach((c) => rows.push(makeRow(c, true)));
      });
      list
        .filter((t) => t.parentId && !tops.find((p) => p.id === t.parentId))
        .forEach((c) => {
          if (!rows.find((r) => r.id === c.id)) {
            rows.push(makeRow(c, false));
          }
        });
      return rows;
    },
    [makeRow],
  );

  return { makeRow, openRowsFor };
}
