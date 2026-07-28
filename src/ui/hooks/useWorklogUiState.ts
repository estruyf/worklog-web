import { useCallback, useEffect, useRef, useState } from "react";
import type { AppView, SearchScope } from "../model";
import { closeTaskDetail, openTaskDetail, useDetailId } from "../router";

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mTitle, setMTitle] = useState("");
  const [mClient, setMClient] = useState("");
  const [mParent, setMParent] = useState("");
  const [mLinks, setMLinks] = useState<string[]>([""]);
  const [mDue, setMDue] = useState("");
  // The task form's tags, as a list — the picker owns normalization, so what
  // sits here is already the exact set that will be written.
  const [mTags, setMTags] = useState<string[]>([]);
  const [mDescription, setMDescription] = useState("");
  const [mDescMode, setMDescMode] = useState<"preview" | "edit">("edit");
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");

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

  const pendingClient = useRef<
    { name: string; target: "modal" | "selected" } | undefined
  >(undefined);

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
    modalOpen,
    setModalOpen,
    editingId,
    setEditingId,
    mTitle,
    setMTitle,
    mClient,
    setMClient,
    mParent,
    setMParent,
    mLinks,
    setMLinks,
    mDue,
    setMDue,
    mTags,
    setMTags,
    mDescription,
    setMDescription,
    mDescMode,
    setMDescMode,
    addingClient,
    setAddingClient,
    newClientName,
    setNewClientName,
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
    pendingClient,
  };
}
