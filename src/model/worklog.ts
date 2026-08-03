export const EVENT_WORKLOG_PREFIX = "event:";

export function eventWorklogClientId(eventType: string): string {
  const normalized = eventType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    throw new Error("Event type is required.");
  }
  return `${EVENT_WORKLOG_PREFIX}${normalized}`;
}

export function isEventWorklogClientId(clientId: string): boolean {
  return clientId.startsWith(EVENT_WORKLOG_PREFIX);
}

export function eventTypeFromClientId(clientId: string): string {
  return isEventWorklogClientId(clientId)
    ? clientId.slice(EVENT_WORKLOG_PREFIX.length)
    : "";
}

export function formatEventTypeLabel(eventType: string): string {
  return eventType
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** The day events the log editor offers, in the order it shows them. They sit
 *  beside the clients in one row of chips, so an event is logged the same way a
 *  client is — the ledger has always treated them the same. */
export const EVENT_TYPES: { id: string; label: string }[] = [
  { id: "vacation", label: "Vacation" },
  { id: "public-holiday", label: "Public holiday" },
  { id: "out-of-office", label: "Out of office" },
  { id: "conference", label: "Conference" },
  { id: "sick", label: "Sick day" },
  { id: "other", label: "Other" },
];

/** Display name for an event type. The table's label wins where it has one
 *  ("Sick day" reads better than the id's "Sick"); anything else — a hand-written
 *  `event:` line the app never offered — falls back to titling the id. */
export function eventLabel(eventType: string): string {
  return EVENT_TYPES.find((e) => e.id === eventType)?.label ?? formatEventTypeLabel(eventType);
}
