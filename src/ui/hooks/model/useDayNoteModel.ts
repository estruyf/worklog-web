// The freeform Markdown note on a day: whether the draft has diverged from what
// is stored, the save, and which days carry one. The draft itself lives in UI
// state and is seeded by the provider when the date changes — saving is
// explicit, the way a task description's is.

import { useCallback, useMemo } from "react";
import type { DayNote } from "../../../model/types";
import { worklogStore } from "../../../data/worklogStore";
import { nowStamp } from "../../../util/date";
import type { WorklogUiState } from "../useWorklogUiState";

export function useDayNoteModel(dayNotes: DayNote[], selectedDate: string, ui: WorklogUiState) {
  const { dayNoteDraft, setDayNoteDraft, setDayNoteMode, setDayNoteSavedAt } = ui;

  /** The dates that have a note, for the calendar's indicator. */
  const datesWithNotes = useMemo(() => new Set(dayNotes.map((n) => n.date)), [dayNotes]);

  const dayNote = dayNotes.find((n) => n.date === selectedDate)?.body ?? "";
  const hasDayNote = dayNote.trim() !== "";
  const dayNoteDirty = dayNoteDraft !== dayNote;

  /** Store `text` as the day's note. Takes the text rather than reading the
   *  draft, so a checkbox ticked in the read-only preview saves the line it just
   *  flipped instead of the draft state it also sets. */
  const saveDayNoteText = useCallback(
    (text: string) => {
      if (!selectedDate) {
        return;
      }
      setDayNoteDraft(text);
      void worklogStore.setDayNote(selectedDate, text);
      setDayNoteSavedAt(nowStamp().slice(11));
      setDayNoteMode("preview");
    },
    [selectedDate, setDayNoteDraft, setDayNoteMode, setDayNoteSavedAt],
  );

  const saveDayNote = useCallback(
    () => saveDayNoteText(dayNoteDraft),
    [saveDayNoteText, dayNoteDraft],
  );

  const editDayNote = useCallback(() => setDayNoteMode("edit"), [setDayNoteMode]);

  /** Leave the editor without keeping what was typed. The draft has to be put
   *  back to the stored body, not just hidden: the preview renders the draft, so
   *  an abandoned one would sit there reading like a saved note. */
  const cancelDayNote = useCallback(() => {
    setDayNoteDraft(dayNote);
    setDayNoteMode("preview");
  }, [dayNote, setDayNoteDraft, setDayNoteMode]);

  // `dayNote` itself stays local: the view renders the draft, and the stored
  // body is only interesting here, as the thing the draft is compared against.
  return { hasDayNote, dayNoteDirty, saveDayNote, saveDayNoteText, editDayNote, cancelDayNote, datesWithNotes };
}
