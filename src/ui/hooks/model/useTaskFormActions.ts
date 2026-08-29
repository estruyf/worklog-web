// Opening and submitting the task form.
//
// The form is a route (/app/new, /app/task/<id>/edit) that owns its own fields:
// opening it is a navigation, nothing more. What the URL can't say — which client
// to start on, whose subtask this is, a due date picked in the calendar — travels
// as the route's seed, which the form reads once when it mounts.
//
// Nothing here holds what the form is currently showing, so nothing here has to
// work out whether it is still showing the right thing. That question used to
// need a ref tracking which task the fields belonged to, an effect to re-seed the
// cases the ref didn't cover, and a second effect to clear it all on the way out;
// a `key` on the form does the same job by remounting it.

import { useCallback } from "react";
import type { Client, Task, WorklogEntry } from "../../../model/types";
import { GENERAL_TODO_CLIENT_ID } from "../../../model/todos";
import { parseRecurrence } from "../../../model/recurrence";
import { worklogStore } from "../../../data/worklogStore";
import { closeTaskForm, closeTaskFormOnto, navigateToTaskForm } from "../../router";
import type { TaskFormFields } from "../../model";
import { canHaveSubtasks, clientIdOf, defaultTaskClientId, isDone } from "../../utils";
import type { WorklogUiState } from "../useWorklogUiState";

interface TaskFormDeps {
  tasks: Task[];
  clients: Client[];
  worklog: WorklogEntry[];
  today: string;
  selectedDate: string;
  selectedClient: string;
}

export function useTaskFormActions(deps: TaskFormDeps, ui: WorklogUiState) {
  const { tasks, clients, worklog, today, selectedDate, selectedClient } = deps;

  /** Which client a brand-new task lands on: the one you're looking at, else the
   *  one the day's work points at. */
  const defaultFormClientId = useCallback(
    () => defaultTaskClientId({ selectedClientId: selectedClient, selectedDate, today, clients, worklog }),
    [selectedClient, selectedDate, today, clients, worklog],
  );

  const openTaskForm = () => navigateToTaskForm(null, { clientId: defaultFormClientId() });
  // Open the new-task form pre-seeded with a due date, e.g. from the calendar
  // when planning work for a future day.
  const openTaskFormForDue = (due: string) => navigateToTaskForm(null, { clientId: defaultFormClientId(), due });
  // Open the new-task form pre-assigned to the general to-do bucket, so the
  // To-dos view can add straight to its own list.
  const openTodoForm = () => navigateToTaskForm(null, { clientId: GENERAL_TODO_CLIENT_ID });
  const openSubtaskForm = (parent: Task) =>
    navigateToTaskForm(null, { clientId: clientIdOf(parent), parentId: parent.id });

  /** "New task" as the open task reads it: a subtask of whatever is open, else a
   *  plain new one. A subtask is open — the tree is one level deep, so there is
   *  no subtask to start under it — falls to the plain one.
   *
   *  Both the ⇧N shortcut and the phone's New button go through here, so the one
   *  button on a phone means what the one keystroke means on a desktop. Seeding
   *  the subtask off the open task is also what carries its client over — a
   *  subtask of a general to-do opens as a to-do rather than as a client task the
   *  user then has to switch. */
  const openTaskFormInContext = () => {
    const detailTask = ui.detailId ? tasks.find((t) => t.id === ui.detailId) : undefined;
    if (detailTask && !isDone(detailTask) && canHaveSubtasks(detailTask)) {
      openSubtaskForm(detailTask);
      return;
    }
    openTaskForm();
  };

  /** Write the open form back to the files. Takes the fields as an argument —
   *  the form holds them, this only knows how to persist them. `editingId` is
   *  the task being edited, or null for a new one.
   *
   *  A new task is awaited rather than fired and forgotten, because where the form
   *  goes next depends on it: the created task opens, and both its id and the state
   *  the panel reads it from only exist once the write has rebuilt the store. */
  const submitTask = async (editingId: string | null, fields: TaskFormFields) => {
    const title = fields.title.trim();
    if (!title || !fields.clientId) {
      return;
    }
    // Blank rows the user added but never filled in are dropped rather than
    // saved — the same rule the client editor's links go through.
    const links = fields.links.map((l) => ({ url: l.url.trim(), label: l.label.trim() })).filter((l) => l.url);
    const due = fields.due.trim() || undefined;
    // An unparseable expression saves as a plain one-off rather than blocking
    // the save; the picker already flags it while you type.
    const parsedRepeat = fields.repeat.trim() ? parseRecurrence(fields.repeat) : undefined;
    const repeat = parsedRepeat
      ? { ...parsedRepeat, anchor: fields.repeatFrom, until: fields.repeatUntil.trim() || undefined }
      : undefined;
    // Already normalized and de-duplicated by the tag picker.
    const tags = fields.tags;
    const description = fields.description.trim();
    if (editingId) {
      worklogStore.updateTask(editingId, {
        title,
        clientId: fields.clientId,
        priority: fields.priority,
        parentId: fields.parentId,
        links,
        description,
        due: due ?? "",
        tags,
        repeat: repeat ?? null,
      });
      closeTaskForm();
      return;
    }
    const created = await worklogStore.createTask({
      title,
      clientId: fields.clientId,
      priority: fields.priority,
      parentId: fields.parentId || undefined,
      links,
      description: description || undefined,
      due,
      tags,
      repeat,
    });
    // A failed write has already toasted, and there is no task to open; leave the
    // form the way any other close does.
    if (!created) {
      closeTaskForm();
      return;
    }
    closeTaskFormOnto(created.id);
  };

  return {
    defaultFormClientId,
    openTaskForm,
    openTaskFormForDue,
    openTodoForm,
    openSubtaskForm,
    openTaskFormInContext,
    submitTask,
  };
}
