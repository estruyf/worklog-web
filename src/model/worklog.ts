import type { Client } from "./types";
import { isGeneralTodoClientId } from "./todos";

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

/** Hours are half-hours in practice, but a sum of them is still floating point:
 *  0.1 + 0.2 has no business reaching a label. */
export function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

/** What an amount of time is worth in hours: a full day and a half day follow
 *  the configured working day, anything else is a number of hours. The one rule
 *  the day editor and the CLI share, so "half" can't mean 4h in one and 3.75h
 *  in the other. Undefined for an amount that isn't one of those. */
export function resolveHours(amount: "full" | "half" | number | string, hoursPerDay: number): number | undefined {
  if (amount === "full") {
    return hoursPerDay;
  }
  if (amount === "half") {
    return hoursPerDay / 2;
  }
  const hours = typeof amount === "number" ? amount : Number(amount.trim().replace(/h$/i, ""));
  return isFinite(hours) && hours >= 0 && String(amount).trim() !== "" ? roundHours(hours) : undefined;
}

/** Why time can't be logged on this client, or undefined when it can. The log
 *  form only offers active clients, and the general to-do list isn't billed. */
export function unloggableReason(clients: Client[], clientId: string): string | undefined {
  if (isGeneralTodoClientId(clientId)) {
    return "The general to-do list belongs to no client, so it has no hours.";
  }
  const client = clients.find((c) => c.id === clientId);
  if (!client) {
    return `Unknown client "${clientId}".`;
  }
  if (client.archived) {
    return `"${client.name}" is archived; restore it in Settings to log time on it.`;
  }
  return undefined;
}
