import { useEffect, useRef, useState } from "react";
import type { AppView, SearchScope } from "../model";

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
  const [searchSel, setSearchSel] = useState(0);

  // Any change to the query or its filters re-orders the hit list, so the
  // keyboard-nav cursor starts over at the top. Reopening the overlay likewise
  // starts the cursor fresh.
  useEffect(() => {
    setSearchSel(0);
  }, [search, searchScope, searchClient, searchOpen]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mTitle, setMTitle] = useState("");
  const [mClient, setMClient] = useState("");
  const [mParent, setMParent] = useState("");
  const [mLinks, setMLinks] = useState<string[]>([""]);
  const [mDue, setMDue] = useState("");
  const [mTags, setMTags] = useState("");
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

  const [detailId, setDetailId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState("");
  const [descMode, setDescMode] = useState<"preview" | "edit">("preview");
  const [noteDraft, setNoteDraft] = useState("");

  const [clientModalOpen, setClientModalOpen] = useState(false);
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
    editingClientId,
    setEditingClientId,
    cName,
    setCName,
    cColor,
    setCColor,
    pendingClient,
  };
}
