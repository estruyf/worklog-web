// Derives the current search hits from the live snapshot + search UI state.
// Shared by the Search view (rendering) and the shell (keyboard nav), so both
// walk the exact same ordered hit list.

import { useMemo } from 'react';
import { useData, useUi } from '../context';
import { clientIdOf, deriveSearch, isDone, linksOf } from '../utils';

export function useSearchData() {
  const { tasks, clientName, colorOf, statusMeta, openDetail } = useData();
  const { search, searchScope, searchClient } = useUi();
  return useMemo(
    () =>
      deriveSearch(tasks, search, searchScope, searchClient, {
        clientIdOf,
        clientName,
        colorOf,
        statusMeta,
        isDone,
        linksOf,
        onEdit: (t) => () => openDetail(t),
      }),
    [tasks, search, searchScope, searchClient, clientName, colorOf, statusMeta, openDetail],
  );
}
