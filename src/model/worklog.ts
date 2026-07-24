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
