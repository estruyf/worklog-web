// Pure search derivation: filter tasks by scope/client, match the query across
// their fields, and bucket the hits by client. Kept free of React/DOM so it can
// be unit-tested directly and shared between the Search view and the shell's
// keyboard-nav handler.

import type { Task } from '../../model/types';
import type { SearchGroup, SearchResult, SearchScope } from '../model';

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

export interface SearchDerived {
  /** The normalised (trimmed, lower-cased) query the results were built from. */
  q: string;
  groups: SearchGroup[];
  /** Every hit in render order — the index space the keyboard cursor walks. */
  flat: SearchResult[];
  count: number;
  /** Unfiltered totals, for the idle-state stats. */
  openCount: number;
  archivedCount: number;
}

export function deriveSearch(
  tasks: Task[],
  rawQuery: string,
  scope: SearchScope,
  clientFilter: string,
  deps: SearchDeps,
): SearchDerived {
  const { clientIdOf, clientName, colorOf, statusMeta, isDone, linksOf, onEdit } = deps;
  const q = rawQuery.trim().toLowerCase();
  const openCount = tasks.filter((t) => !isDone(t)).length;
  const archivedCount = tasks.length - openCount;

  if (!q) {
    return { q, groups: [], flat: [], count: 0, openCount, archivedCount };
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
  return { q, groups, flat, count: flat.length, openCount, archivedCount };
}
