// Derives the current search hits from the live snapshot + search UI state.
// Shared by the Search view (rendering) and the shell (keyboard nav), so both
// walk the exact same ordered hit list.

import { useMemo } from 'react';
import { useData, useUi } from '../context';
import { navigateToView } from '../router';
import { appendGroup, clientIdOf, deriveListGroup, deriveNoteGroup, deriveSearch, isDone, linksOf } from '../utils';

export function useSearchData() {
  const { tasks, dayNotes, checklists, features, clientName, colorOf, statusMeta, openDetail } = useData();
  const { search, searchScope, searchClient, tagFilter, setSelectedDate, setSearchOpen, setShowListId } = useUi();
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
    // Nothing to offer when Lists is switched off in Settings: the view it would
    // open falls back to the day, so a hit there is a dead end.
    const lists = deriveListGroup(features.lists ? checklists : [], filters, {
      onOpen: (listId) => () => {
        setShowListId(listId);
        navigateToView('lists');
        setSearchOpen(false);
      },
    });
    // Lists after notes, for the same reason notes come after tasks: the overlay
    // renders groups in array order and the shell indexes straight into `flat`.
    return appendGroup(appendGroup(tasksDerived, notes, { noteCount: dayNotes.length }), lists, {
      listCount: features.lists ? checklists.length : 0,
    });
  }, [
    tasks,
    dayNotes,
    checklists,
    features,
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
    setShowListId,
  ]);
}
