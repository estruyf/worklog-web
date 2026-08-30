import { useCallback, useEffect, useState } from "react";
import type { AppView, LinkDraft, SearchScope } from "../model";
import { closeTask, navigateToTask, useDetailId } from "../router";
import { useConfirmDialog } from "./useConfirmDialog";

/** Everything the transient UI state holds — the shape `useUi()` returns, and
 *  what the model hooks take when they need to read or drive a selection. */
export type WorklogUiState = ReturnType<typeof useWorklogUiState>;

export function useWorklogUiState() {
  const [view, setView] = useState<AppView>("day");
  const [selectedDate, setSelectedDate] = useState("");
  const [editDayOpen, setEditDayOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [month, setMonth] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [searchClient, setSearchClient] = useState("");
  // Tags a task must all carry to be a hit. Doubles as a standalone filter: with
  // tags picked and no query, the overlay browses everything tagged that way.
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [searchSel, setSearchSel] = useState(0);
  // Any change to the query or its filters re-orders the hit list, so the
  // keyboard-nav cursor starts over at the top. Reopening the overlay likewise
  // starts the cursor fresh.
  useEffect(() => {
    setSearchSel(0);
  }, [search, searchScope, searchClient, tagFilter, searchOpen]);

  // Closing the overlay drops the query and every filter, so the next open is a
  // clean slate rather than a resumed session. Reset on close, not on open, so
  // callers that seed a filter first (openTagSearch) survive the transition.
  useEffect(() => {
    if (searchOpen) {
      return;
    }
    setSearch("");
    setSearchScope("all");
    setSearchClient("");
    setTagFilter([]);
  }, [searchOpen]);

  // The task form's fields are deliberately absent: it is a route
  // (/app/new, /app/task/<id>/edit) that owns its own state and starts from the
  // task or the seed it is mounted with (see TaskFormPage / router's
  // useTaskFormInstance). Holding them here meant every keystroke in the form
  // re-rendered every consumer of this hook, and it took a ref plus a route
  // effect to keep "which task are these fields for" honest.

  const [logOpen, setLogOpen] = useState(false);
  // The worklog client id the editor is editing, '' while it is logging a new
  // entry. Doubles as "is this an edit", which is why there is no separate flag.
  const [logEditingClientId, setLogEditingClientId] = useState("");
  const [logIsEvent, setLogIsEvent] = useState(false);
  const [logEventType, setLogEventType] = useState("vacation");
  const [logClient, setLogClient] = useState("");
  const [logType, setLogType] = useState("full");
  const [logHours, setLogHours] = useState<number | string>(2);
  const [logNote, setLogNote] = useState("");

  // The open task is the URL (see ../router): /app/task/<id> is a route like any
  // other, which is what makes the task in front of you a link you can hand to
  // someone. Nothing here holds it, so nothing here can disagree with the address
  // bar; opening and closing are navigations.
  const detailId = useDetailId();
  const setDetailId = useCallback((id: string | null) => {
    if (id) {
      navigateToTask(id);
    } else {
      closeTask();
    }
  }, []);
  const [descDraft, setDescDraft] = useState("");
  // A task opens on its description as stored; `edit`/`preview` are the two
  // halves of an editor that has been opened deliberately (see DescriptionMode).
  const [descMode, setDescMode] = useState<"read" | "preview" | "edit">("read");
  const [noteDraft, setNoteDraft] = useState("");
  // Whether the open task's prompt composer is up. Here rather than inside the
  // section because the way *in* to the first prompt is the content-action row
  // next to "+ Description" — a different component, one block above it.
  const [promptComposing, setPromptComposing] = useState(false);

  // The day view's freeform Markdown for `selectedDate`. Distinct from
  // `noteDraft` above, which is the *task* note composer — the two sit side by
  // side and are never the same thing, hence `dayNote*` throughout.
  const [dayNoteDraft, setDayNoteDraft] = useState("");
  const [dayNoteMode, setDayNoteMode] = useState<"preview" | "edit">("preview");
  // Local "HH:mm" of the last save, '' before one. Session-only and deliberately
  // so: it confirms the click that just happened, which is the moment the Save
  // button disappears and there is otherwise nothing to say the note landed.
  const [dayNoteSavedAt, setDayNoteSavedAt] = useState("");

  const [clientModalOpen, setClientModalOpen] = useState(false);
  // Whether the Clients view reveals the archived clients under its list.
  const [showArchivedClients, setShowArchivedClients] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [cName, setCName] = useState("");
  const [cColor, setCColor] = useState("");
  const [cDesc, setCDesc] = useState("");
  // The same draft shape the task form's links use, so both go through
  // `LinksField`: a blank label is '' while typing and dropped on save.
  const [cLinks, setCLinks] = useState<LinkDraft[]>([]);

  // The one open confirmation / notice, plus the promise-based API actions use to
  // raise one. Kept as its own namespace so `ui.confirm.ask(...)` reads as the
  // question it is.
  const confirm = useConfirmDialog();

  return {
    view,
    setView,
    selectedDate,
    setSelectedDate,
    editDayOpen,
    setEditDayOpen,
    selectedClient,
    setSelectedClient,
    month,
    setMonth,
    searchOpen,
    setSearchOpen,
    search,
    setSearch,
    searchScope,
    setSearchScope,
    searchClient,
    setSearchClient,
    tagFilter,
    setTagFilter,
    searchSel,
    setSearchSel,
    logOpen,
    setLogOpen,
    logEditingClientId,
    setLogEditingClientId,
    logIsEvent,
    setLogIsEvent,
    logEventType,
    setLogEventType,
    logClient,
    setLogClient,
    logType,
    setLogType,
    logHours,
    setLogHours,
    logNote,
    setLogNote,
    detailId,
    setDetailId,
    descDraft,
    setDescDraft,
    descMode,
    setDescMode,
    noteDraft,
    setNoteDraft,
    promptComposing,
    setPromptComposing,
    dayNoteDraft,
    setDayNoteDraft,
    dayNoteMode,
    setDayNoteMode,
    dayNoteSavedAt,
    setDayNoteSavedAt,
    clientModalOpen,
    setClientModalOpen,
    showArchivedClients,
    setShowArchivedClients,
    editingClientId,
    setEditingClientId,
    cName,
    setCName,
    cColor,
    setCColor,
    cDesc,
    setCDesc,
    cLinks,
    setCLinks,
    confirm,
  };
}
