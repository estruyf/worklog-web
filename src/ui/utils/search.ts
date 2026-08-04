// Pure search derivation: filter tasks by scope/client, match the query across
// their fields, and bucket the hits by client. Kept free of React/DOM so it can
// be unit-tested directly and shared between the Search view and the shell's
// keyboard-nav handler.
//
// Day notes are a second, much simpler corpus, derived by `deriveNoteGroup` and
// stapled on with `appendGroup` rather than folded into `deriveSearch`. They
// have no client to group by and no open/archived state to scope by, so pushing
// them through the task pipeline would mean weakening every rule in it.

import type { DayNote, Task } from '../../model/types';
import type { SearchGroup, SearchResult, SearchScope } from '../model';
import { fmtLong } from './date';

export interface SplitMatch {
  pre: string;
  mid: string;
  post: string;
  hasMid: boolean;
}

/** Split `text` around the first case-insensitive occurrence of `q`. */
export function splitMatch(text: string, q: string): SplitMatch {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) {
    return { pre: text, mid: '', post: '', hasMid: false };
  }
  return { pre: text.slice(0, i), mid: text.slice(i, i + q.length), post: text.slice(i + q.length), hasMid: true };
}

/** The read-model helpers the derivation needs, injected so it stays pure. */
export interface SearchDeps {
  clientIdOf: (t: Task) => string;
  clientName: (id: string) => string;
  colorOf: (id: string) => string;
  statusMeta: (statusId: string, done: boolean) => { label: string; color: string };
  isDone: (t: Task) => boolean;
  linksOf: (t: Task) => string[];
  /** Builds the row's open-detail handler for a matched task. */
  onEdit: (t: Task) => () => void;
}

/** What the hit list is narrowed by. A query is not required: tags alone are a
 *  valid filter, which is how "show me everything tagged bug" works. */
export interface SearchFilters {
  query: string;
  scope: SearchScope;
  /** Client id, or '' for every client. */
  client: string;
  /** Tags a task must carry — all of them. Empty means no tag filter. */
  tags: string[];
}

export interface SearchDerived {
  /** The normalised (trimmed, lower-cased) query the results were built from. */
  q: string;
  /** True when anything is narrowing the list — a query, tags, or both. */
  filtered: boolean;
  groups: SearchGroup[];
  /** Every hit in render order — the index space the keyboard cursor walks. */
  flat: SearchResult[];
  count: number;
  /** Unfiltered totals, for the idle-state stats. */
  openCount: number;
  archivedCount: number;
  /** Unfiltered day-note total. Filled in by {@link appendGroup}. */
  noteCount: number;
}

export function deriveSearch(tasks: Task[], filters: SearchFilters, deps: SearchDeps): SearchDerived {
  const { clientIdOf, clientName, colorOf, statusMeta, isDone, linksOf, onEdit } = deps;
  const { scope, client: clientFilter } = filters;
  const q = filters.query.trim().toLowerCase();
  const tagFilter = filters.tags.map((t) => t.toLowerCase());
  const filtered = q !== '' || tagFilter.length > 0;
  const openCount = tasks.filter((t) => !isDone(t)).length;
  const archivedCount = tasks.length - openCount;

  if (!filtered) {
    return { q, filtered, groups: [], flat: [], count: 0, openCount, archivedCount, noteCount: 0 };
  }

  const groupsByClient = new Map<string, SearchGroup>();

  for (const t of tasks) {
    const done = isDone(t);
    if (scope === 'open' && done) {
      continue;
    }
    if (scope === 'archived' && !done) {
      continue;
    }
    const cid = clientIdOf(t);
    if (clientFilter && cid !== clientFilter) {
      continue;
    }

    const cname = clientName(cid);
    const desc = t.description ?? '';
    const links = linksOf(t);
    const tags = t.tags ?? [];

    // Tags narrow before the query does, and every picked tag must be present.
    if (tagFilter.length > 0) {
      const lower = tags.map((tag) => tag.toLowerCase());
      if (!tagFilter.every((tag) => lower.includes(tag))) {
        continue;
      }
    }

    // With no query every field trivially "contains" the empty string, so a
    // tags-only filter falls through as a plain, unhighlighted match.
    const inTitle = t.title.toLowerCase().includes(q);
    const inDesc = desc.toLowerCase().includes(q);
    const inLink = links.join(' ').toLowerCase().includes(q);
    const inId = t.id.toLowerCase().includes(q);
    const inTags = tags.join(' ').toLowerCase().includes(q);
    const inClient = cname.toLowerCase().includes(q);

    if (!(inTitle || inDesc || inLink || inId || inTags || inClient)) {
      continue;
    }

    const sm = statusMeta(t.status, done);
    const sp = splitMatch(t.title, q);
    // A description snippet only earns its second line when the title itself
    // didn't already surface the match.
    const snippet = inDesc && !inTitle ? desc : '';
    // The badge only appears when the hit is *purely* from a link/id — the
    // human-readable fields didn't match at all.
    const matchBadge: SearchResult['matchBadge'] =
      !inTitle && !inDesc && !inTags && !inClient ? (inLink ? 'link' : inId ? 'id' : '') : '';

    const row: SearchResult = {
      kind: 'task',
      title: t.title,
      clientName: cname,
      color: colorOf(cid),
      statusLabel: sm.label,
      statusColor: sm.color,
      hasLink: links.length > 0,
      link: links[0] || '',
      tags,
      pre: sp.pre,
      mid: sp.mid,
      post: sp.post,
      hasMid: sp.hasMid,
      snippet,
      matchBadge,
      onEdit: onEdit(t),
    };

    let g = groupsByClient.get(cid);
    if (!g) {
      g = { name: cname, color: colorOf(cid), count: 0, rows: [] };
      groupsByClient.set(cid, g);
    }
    g.rows.push(row);
    g.count++;
  }

  const groups = [...groupsByClient.values()];
  // Flatten in group render order so the cursor index lines up with the DOM.
  const flat = groups.flatMap((g) => g.rows);
  return { q, filtered, groups, flat, count: flat.length, openCount, archivedCount, noteCount: 0 };
}

// ---- day notes -------------------------------------------------------------

/** The group day-note hits are collected under. Not a client, so it gets its own
 *  colour the way the calendar's day events do. */
export const NOTE_GROUP_NAME = 'Day notes';
export const NOTE_COLOR = '#7C74C9';

/** How much of a note body to show around the match. A day note runs to
 *  paragraphs, so handing the whole body to a one-line row would show its
 *  opening and never the words that matched. */
const SNIPPET_RADIUS = 60;

/** A one-line excerpt of `text` centred on the first occurrence of `q`, with
 *  ellipses where it was cut. Falls back to the head of the text when `q` is
 *  empty or absent. */
export function snippetAround(text: string, q: string, radius = SNIPPET_RADIUS): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = q ? flat.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) {
    return flat.length > radius * 2 ? `${flat.slice(0, radius * 2).trimEnd()}…` : flat;
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + q.length + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

export interface NoteSearchDeps {
  /** Builds the row's open handler — navigating to that day. */
  onOpen: (date: string) => () => void;
}

/** Day-note hits for the current query, or `undefined` when notes don't apply.
 *
 *  They are shown under the `all` scope only: "open" and "archived" are states a
 *  note doesn't have, and a note belongs to no client and carries no tags — so a
 *  lit client chip or tag would be describing something the note can't satisfy. */
export function deriveNoteGroup(
  notes: DayNote[],
  filters: SearchFilters,
  deps: NoteSearchDeps,
): SearchGroup | undefined {
  const q = filters.query.trim().toLowerCase();
  if (!q || filters.scope !== 'all' || filters.client !== '' || filters.tags.length > 0) {
    return undefined;
  }

  // Newest first: a day note is looked up by recency far more often than a task
  // is, and the task groups' created-order would bury this week's under 2024's.
  const hits = notes
    .filter((n) => n.body.toLowerCase().includes(q) || n.date.includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (hits.length === 0) {
    return undefined;
  }

  const rows: SearchResult[] = hits.map((n) => {
    const title = fmtLong(n.date);
    const sp = splitMatch(title, q);
    return {
      kind: 'note',
      title,
      hasLink: false,
      link: '',
      tags: [],
      pre: sp.pre,
      mid: sp.mid,
      post: sp.post,
      hasMid: sp.hasMid,
      snippet: snippetAround(n.body, q),
      matchBadge: '',
      onEdit: deps.onOpen(n.date),
    };
  });
  return { name: NOTE_GROUP_NAME, color: NOTE_COLOR, count: rows.length, rows };
}

/** Staple a group onto a derivation, keeping `flat` in render order.
 *
 *  Appending rather than merging is what lets the shell's ↑/↓/↵ walk `flat` by
 *  index without knowing day notes exist: the overlay renders groups in order,
 *  so last-in-the-list is last-in-the-DOM. */
export function appendGroup(derived: SearchDerived, group: SearchGroup | undefined, noteCount = 0): SearchDerived {
  if (!group) {
    return { ...derived, noteCount };
  }
  const groups = [...derived.groups, group];
  const flat = [...derived.flat, ...group.rows];
  return { ...derived, groups, flat, count: flat.length, noteCount };
}
