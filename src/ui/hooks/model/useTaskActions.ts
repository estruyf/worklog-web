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

  // The tick fires with no confirmation, so the toast it raises carries the way
  // back: Undo restores the task's status — and each open subtask's, since
  // closing a parent cascades to them. A repeating task gets no Undo: completing
  // one rolls it onto its next occurrence rather than closing it, and the Done
  // list's reopen is the path that unwinds an occurrence.
  const markDone = useCallback(
    async (t: Task) => {
      const restore = [t, ...tasks.filter((c) => c.parentId === t.id && !isDone(c))].map((x) => ({
        id: x.id,
        status: x.status,
      }));
      const closed = await worklogStore.closeTask(t.id, selectedDate);
      if (!closed) {
        return;
      }
      worklogStore.notify({
        message: `Completed “${t.title}”`,
        tone: "success",
        action: t.repeat
          ? undefined
          : {
              label: "Undo",
              run: () =>
                void (async () => {
                  // Parent first — that pulls it back out of the archive — then
                  // the subtasks it took down with it. Sequential: each write
                  // reads and rewrites the same client file.
                  for (const r of restore) {
                    await worklogStore.setStatus(r.id, r.status);
                  }
                })(),
            },
      });
    },
    [tasks, selectedDate],
  );
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

  /** Read a picked/dropped file and record it on the task. Resolves once the
   *  attachment is saved (or its failure is on screen as a toast), so callers
   *  can hold an uploading state across it. */
  const addAttachment = useCallback((taskId: string, file: File) => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => {
        worklogStore.notify({ message: `Could not read “${file.name}”.`, tone: "error" });
        resolve();
      };
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        worklogStore.addAttachment(taskId, file.name, base64).then(resolve);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const deleteAttachment = useCallback((taskId: string, ref: string) => {
    worklogStore.deleteAttachment(taskId, ref);
  }, []);

  /** Hand the attachment's bytes to the browser as a download. */
  const downloadAttachment = useCallback(async (ref: string) => {
    const bytes = await worklogStore.assetBytes(ref);
    if (!bytes) {
      worklogStore.notify({ message: "This attachment isn't on this device yet — reconnect and try again.", tone: "error" });
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = ref.split("/").pop() ?? "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // On a delay: revoking synchronously can cancel the navigation the click
    // just started.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, []);

  /**
   * Write `text` to the open task's description and close the editor. Takes the
   * text rather than reading the draft because a checkbox ticked in the stored
   * description has to save the text it just produced — the draft state it also
   * sets is a render away.
   */
  const saveDescriptionText = (text: string) => {
    if (!detailId) {
      return;
    }
    ui.setDescDraft(text);
    worklogStore.updateTask(detailId, { description: text });
    setDescMode("read");
  };

  /** Commit the detail panel's markdown draft and close the editor. */
  const saveDescription = () => saveDescriptionText(ui.descDraft);

  /** Open the editor on the stored description. */
  const editDescription = () => setDescMode("edit");

  /** Leave the editor without keeping what was typed. The draft is put back
   *  rather than just hidden: what stays on screen is that draft rendered, so an
   *  abandoned one would sit there reading like a saved description. */
  const cancelDescription = () => {
    ui.setDescDraft(tasks.find((t) => t.id === detailId)?.description ?? "");
    setDescMode("read");
  };

  return { markDone, toggleWorked, openDetail, openEdit, deleteTask, addNote, updateNote, deleteNote, addAttachment, deleteAttachment, downloadAttachment, saveDescription, saveDescriptionText, editDescription, cancelDescription };
}
