// Turning a task into the row every list in the app renders, with its actions
// pre-bound. `WorklogRow` is the one shape WorklogTaskRow knows about, so this is
// where "a task" becomes "a line on screen".

import { useCallback } from "react";
import type { Task } from "../../../model/types";
import { isGeneralTodoClientId } from "../../../model/todos";
import { describeRecurrence } from "../../../model/recurrence";
import { isMarkedPriority, priorityDef } from "../../../model/priority";
import { daysSinceEpoch } from "../../../util/date";
import type { StatusChoice, StatusMetaFn, WorklogRow } from "../../model";
import { clientIdOf, dueOn, isDone, linksOf, planTaskRows, workedOnDate } from "../../utils";

/** Everything a row needs that isn't the task itself: the day it is shown on, and
 *  the actions its buttons fire. */
export interface TaskRowDeps {
  tasks: Task[];
  today: string;
  selectedDate: string;
  /** Parents whose subtasks are folded away — see `useCollapsedTasks`. */
  collapsed: ReadonlySet<string>;
  toggleCollapsed: (id: string) => void;
  statusMeta: StatusMetaFn;
  /** Every configured status, in order — what a row's picker offers. */
  statusChoices: StatusChoice[];
  setTaskStatus: (taskId: string, statusId: string) => void;
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
    collapsed,
    toggleCollapsed,
    statusMeta,
    statusChoices,
    setTaskStatus,
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
      // status to show or move between.
      const todo = isGeneralTodoClientId(clientIdOf(t));
      const done = isDone(t);
      const m = todo ? undefined : statusMeta(t.status, done);
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
        status: m && {
          id: t.status,
          label: m.label,
          name: m.name,
          color: m.color,
          done,
          choices: statusChoices,
          onSelect: (statusId: string) => setTaskStatus(t.id, statusId),
        },
        // Shown on done rows too: a completed task that was urgent still was.
        priority: isMarkedPriority(t.priority) ? priorityDef(t.priority) : undefined,
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
        onDone: () => markDone(t),
        onWorked: todo ? undefined : () => toggleWorked(t),
        onEdit: () => openEdit(t),
        onDelete: () => deleteTask(t.id),
        onTagClick: openTagSearch,
      };
    },
    [
      statusMeta,
      statusChoices,
      setTaskStatus,
      selectedDate,
      tasks,
      today,
      openDetail,
      markDone,
      toggleWorked,
      openEdit,
      deleteTask,
      openTagSearch,
    ],
  );

  /** A flat list of rows with subtasks indented under their parent, and orphaned
   *  subtasks (whose parent isn't in `list`) shown at top level. Parents the user
   *  has folded shut carry the toggle and drop their children — the nesting rules
   *  themselves are `planTaskRows`. */
  const openRowsFor = useCallback(
    (list: Task[]): WorklogRow[] =>
      planTaskRows(list, collapsed).map((plan) => {
        const row = makeRow(plan.task, plan.child);
        if (!plan.foldable) {
          return row;
        }
        return { ...row, collapsed: plan.collapsed, onToggleCollapse: () => toggleCollapsed(plan.task.id) };
      }),
    [makeRow, collapsed, toggleCollapsed],
  );

  return { makeRow, openRowsFor };
}
