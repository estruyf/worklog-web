// Pure archive derivation: filter the completed tasks by query/client/period,
// slice the result into pages and bucket the current page by client. Kept free of
// React/DOM so it can be unit-tested directly, like the search derivation.

import type { Task } from '../../model/types';
import type { ArchiveGroup } from '../model';
import { shiftDate } from './date';
import { clientIdOf, isDone } from './task';
import { matchesTaskQuery } from './taskFilter';

/** Completion window the Archive view filters on. */
export type ArchivePeriod = 'all' | '30d' | '90d' | 'year';

export const ARCHIVE_PAGE_SIZES = [25, 50, 100];

export interface ArchiveFilters {
  /** Free text, matched against title, description, tags, links, id and client name. */
  query: string;
  /** Single client id, or '' for all clients. */
  clientId: string;
  period: ArchivePeriod;
  /** 1-based; clamped to the available page count. */
  page: number;
  pageSize: number;
}

/** The read-model helpers the derivation needs, injected so it stays pure. */
export interface ArchiveDeps {
  clientName: (id: string) => string;
  colorOf: (id: string) => string;
  /** Local YYYY-MM-DD, the anchor the relative periods count back from. */
  today: string;
}

export interface ArchiveDerived {
  /** Every archived task, before any filter — the view's headline count. */
  totalCount: number;
  /** Archived tasks matching the filters, across all pages. */
  filteredCount: number;
  /** The clamped page actually rendered. */
  page: number;
  pageCount: number;
  /** 1-based inclusive range of the rendered slice; 0/0 when nothing matched. */
  from: number;
  to: number;
  /** The current page's tasks, bucketed by client in first-appearance order. */
  groups: ArchiveGroup[];
  /** Per-client match counts with every filter *except* the client one applied,
   * so the picker can show what each option would yield. */
  clientCounts: Record<string, number>;
}

/** Inclusive lower bound (YYYY-MM-DD) for a period, or '' for all time. */
export function periodStart(period: ArchivePeriod, today: string): string {
  switch (period) {
    case '30d':
      return shiftDate(today, -29);
    case '90d':
      return shiftDate(today, -89);
    case 'year':
      return `${today.slice(0, 4)}-01-01`;
    default:
      return '';
  }
}

export function deriveArchive(tasks: Task[], filters: ArchiveFilters, deps: ArchiveDeps): ArchiveDerived {
  const { clientName, colorOf, today } = deps;
  const q = filters.query.trim().toLowerCase();
  const start = periodStart(filters.period, today);

  const archived = tasks.filter(isDone);
  // Query + period only: these counts drive the client picker, so they must not
  // be narrowed by the client selection itself.
  const facetMatched = archived.filter(
    (t) => (!start || (t.completed ?? '') >= start) && matchesTaskQuery(t, q, clientName(clientIdOf(t))),
  );

  const clientCounts: Record<string, number> = {};
  for (const t of facetMatched) {
    const cid = clientIdOf(t);
    clientCounts[cid] = (clientCounts[cid] ?? 0) + 1;
  }

  const matched = facetMatched
    .filter((t) => !filters.clientId || clientIdOf(t) === filters.clientId)
    .sort((a, b) => (b.completed ?? '').localeCompare(a.completed ?? '') || a.title.localeCompare(b.title));

  const pageSize = Math.max(1, filters.pageSize);
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const offset = (page - 1) * pageSize;
  const slice = matched.slice(offset, offset + pageSize);

  // Grouped in first-appearance order, which — because the slice is sorted by
  // completion date — puts the most recently finished work at the top.
  const groupsByClient = new Map<string, ArchiveGroup>();
  for (const t of slice) {
    const cid = clientIdOf(t);
    let g = groupsByClient.get(cid);
    if (!g) {
      g = { id: cid, name: clientName(cid), color: colorOf(cid), count: 0, tasks: [] };
      groupsByClient.set(cid, g);
    }
    g.tasks.push(t);
    g.count++;
  }

  return {
    totalCount: archived.length,
    filteredCount: matched.length,
    page,
    pageCount,
    from: matched.length === 0 ? 0 : offset + 1,
    to: offset + slice.length,
    groups: [...groupsByClient.values()],
    clientCounts,
  };
}

/** Page numbers to render in the pager, with `null` marking an elided run. */
export function pageWindow(page: number, pageCount: number, span = 2): (number | null)[] {
  const wanted = new Set<number>([1, pageCount]);
  for (let p = page - span; p <= page + span; p++) {
    if (p >= 1 && p <= pageCount) {
      wanted.add(p);
    }
  }
  const pages = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) {
      out.push(null);
    }
    out.push(p);
    prev = p;
  }
  return out;
}
