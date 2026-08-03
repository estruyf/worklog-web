// Worklog entries are keyed by client id, except for events, which use a
// pseudo-client id. Both the grid and the legend have to resolve one to a name
// and a colour, and getting the event branch wrong shows a blank name in a cell.

import { eventLabel, eventTypeFromClientId, isEventWorklogClientId } from '../../../model/worklog';
import { EVENT_COLOR } from '../../utils';

/** Display name for a worklog client id, resolving event pseudo-clients. */
export function labelFor(clientId: string, clientName: (id: string) => string): string {
  return isEventWorklogClientId(clientId) ? eventLabel(eventTypeFromClientId(clientId)) : clientName(clientId);
}

/** Dot colour for a worklog client id. Every event wears the one event colour. */
export function colorFor(clientId: string, colorOf: (id: string) => string): string {
  return isEventWorklogClientId(clientId) ? EVENT_COLOR : colorOf(clientId);
}
