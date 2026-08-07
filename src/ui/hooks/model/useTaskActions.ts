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

      // Closing a repeating task only rolls it onto its next occurrence, so
      // archiving one has to end the series explicitly. Completions already
      // logged are separate archived blocks and survive either way.
      const isPermanent = options?.permanent || isDone(t);
      const repeating = !!t.repeat && !isDone(t);
      const ok = isPermanent
        ? await ask({
            title: `Delete "${t.title}" forever?`,
            message: "This also removes subtasks and cannot be undone.",
            confirmLabel: "Delete forever",
            tone: "danger",
          })
        : await ask({
            title: repeating
              ? `Stop "${t.title}" from repeating and move it to archive?`
              : `Move "${t.title}" to archive?`,
            message: repeating
              ? "The series ends here. You can restore it later from Archive."
              : "You can restore it later from Archive.",
            confirmLabel: repeating ? "Stop and archive" : "Move to archive",
          });

      if (!ok) {
        return;
      }

      if (isPermanent) {
        worklogStore.deleteTask(id);
        if (detailId === id) {
          setDetailId(null);
        }
      } else if (repeating) {
        worklogStore.endSeries(id, selectedDate);
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

  const updateNote = useCallback((taskId: string, index: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    worklogStore.updateNote(taskId, index, trimmed);
  }, []);

  const deleteNote = useCallback((taskId: string, index: number) => {
    worklogStore.deleteNote(taskId, index);
  }, []);

  /**
   * Write `text` to the open task's description and leave the panel in preview.
   * Takes the text rather than reading the draft because a checkbox ticked in
   * the preview has to save the text it just produced — the draft state it also
   * sets is a render away.
   */
  const saveDescriptionText = (text: string) => {
    if (!detailId) {
      return;
    }
    ui.setDescDraft(text);
    worklogStore.updateTask(detailId, { description: text });
    setDescMode("preview");
  };

  /** Commit the detail panel's markdown draft and drop back to preview. */
  const saveDescription = () => saveDescriptionText(ui.descDraft);

  return { markDone, toggleWorked, openDetail, openEdit, deleteTask, addNote, updateNote, deleteNote, saveDescription, saveDescriptionText };
}
