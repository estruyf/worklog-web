import { useCallback, useEffect, useState } from "react";
import type { AppView, LinkDraft, SearchScope } from "../model";
import { closeTaskDetail, openTaskDetail, useDetailId } from "../router";
import { useConfirmDialog } from "./useConfirmDialog";

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
  const [logEditing, setLogEditing] = useState(false);
  const [logIsEvent, setLogIsEvent] = useState(false);
  const [logEventType, setLogEventType] = useState("vacation");
  const [logClient, setLogClient] = useState("");
  const [logType, setLogType] = useState("full");
  const [logHours, setLogHours] = useState<number | string>(2);
  const [logNote, setLogNote] = useState("");

  // The open task lives in history rather than in component state (see ../router):
  // opening one pushes an entry so the browser's Back button closes the panel
  // instead of navigating the app behind it and leaving it stranded on top. On
  // the routed /app/task/<id> page the id comes from the route itself.
  const detailId = useDetailId();
  const setDetailId = useCallback((id: string | null) => {
    if (id) {
      openTaskDetail(id);
    } else {
      closeTaskDetail();
    }
  }, []);
  const [descDraft, setDescDraft] = useState("");
  const [descMode, setDescMode] = useState<"preview" | "edit">("preview");
  const [noteDraft, setNoteDraft] = useState("");

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
    logEditing,
    setLogEditing,
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
