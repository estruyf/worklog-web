// What can be done to one task from anywhere in the app: open it, mark it, edit
// its notes and description, and get rid of it.

import { useCallback } from "react";
import type { Task } from "../../../model/types";
import { worklogStore } from "../../../data/worklogStore";
import { closeTaskForm, navigateToTaskForm, useRoute } from "../../router";
import { isDone } from "../../utils";
import type { WorklogUiState } from "../useWorklogUiState";

export function useTaskActions(tasks: Task[], selectedDate: string, ui: WorklogUiState) {
  const { detailId, setDetailId, setDescMode } = ui;
  const { ask } = ui.confirm;
  const route = useRoute();

  const markDone = useCallback((t: Task) => worklogStore.closeTask(t.id, selectedDate), [selectedDate]);
  const toggleWorked = useCallback((t: Task) => worklogStore.toggleWorked(t.id, selectedDate), [selectedDate]);
  const openDetail = useCallback((t: Task) => setDetailId(t.id), [setDetailId]);
  const openEdit = useCallback((t: Task) => navigateToTaskForm(t.id), []);

  const deleteTask = useCallback(
    async (id: string, options?: { permanent?: boolean }) => {
      const t = tasks.find((x) => x.id === id);
      if (!t) {
        return;
      }

      // A repeating task can't be "moved to archive" — closing it just rolls it
      // onto its next occurrence — so deleting one ends the series outright.
      // Completions already logged are separate archived blocks and survive.
      const isPermanent = options?.permanent || isDone(t) || !!t.repeat;
      const repeating = !!t.repeat && !isDone(t);
      const ok = isPermanent
        ? await ask({
            title: repeating ? `Stop "${t.title}" from repeating and delete it?` : `Delete "${t.title}" forever?`,
            message: repeating
              ? "The series ends here. Completions already logged stay in the archive."
              : "This also removes subtasks and cannot be undone.",
            confirmLabel: repeating ? "Stop and delete" : "Delete forever",
            tone: "danger",
          })
        : await ask({
            title: `Move "${t.title}" to archive?`,
            message: "You can restore it later from Archive.",
            confirmLabel: "Move to archive",
          });

      if (!ok) {
        return;
      }

      if (isPermanent) {
        worklogStore.deleteTask(id);
        if (detailId === id) {
          setDetailId(null);
        }
      } else {
        worklogStore.closeTask(id, selectedDate);
      }

      // Deleting the task the form is open on leaves the form with nothing to
      // save, so step off the route too.
      if (route.name === "taskForm" && route.taskId === id) {
        closeTaskForm();
      }
    },
    [tasks, detailId, setDetailId, ask, route, selectedDate],
  );

  const addNote = useCallback((taskId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    worklogStore.addNote(taskId, trimmed);
  }, []);

  const deleteNote = useCallback((taskId: string, index: number) => {
    worklogStore.deleteNote(taskId, index);
  }, []);

  /** Commit the detail panel's markdown draft and drop back to preview. */
  const saveDescription = () => {
    if (!detailId) {
      return;
    }
    worklogStore.updateTask(detailId, { description: ui.descDraft });
    setDescMode("preview");
  };

  return { markDone, toggleWorked, openDetail, openEdit, deleteTask, addNote, deleteNote, saveDescription };
}
