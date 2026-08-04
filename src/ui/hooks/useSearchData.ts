// Derives the current search hits from the live snapshot + search UI state.
// Shared by the Search view (rendering) and the shell (keyboard nav), so both
// walk the exact same ordered hit list.

import { useMemo } from 'react';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import { appendGroup, clientIdOf, deriveNoteGroup, deriveSearch, isDone, linksOf } from '../utils';

export function useSearchData() {
  const { tasks, dayNotes, clientName, colorOf, statusMeta, openDetail } = useData();
  const { search, searchScope, searchClient, tagFilter, setSelectedDate, setSearchOpen } = useUi();
  return useMemo(() => {
    const filters = { query: search, scope: searchScope, client: searchClient, tags: tagFilter };
    const tasksDerived = deriveSearch(tasks, filters, {
      clientIdOf,
      clientName,
      colorOf,
      statusMeta,
      isDone,
      linksOf,
      onEdit: (t) => () => openDetail(t),
    });
    // Notes go last so `flat` stays in DOM order — the overlay renders groups in
    // array order, and the shell's ↑/↓/↵ indexes straight into `flat`.
    const notes = deriveNoteGroup(dayNotes, filters, {
      onOpen: (date) => () => {
        setSelectedDate(date);
        navigateToView('day');
        setSearchOpen(false);
      },
    });
    return appendGroup(tasksDerived, notes, dayNotes.length);
  }, [
    tasks,
    dayNotes,
    search,
    searchScope,
    searchClient,
    tagFilter,
    clientName,
    colorOf,
    statusMeta,
    openDetail,
    setSelectedDate,
    setSearchOpen,
  ]);
}
