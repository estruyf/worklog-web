// The filter + sort strip that sits above an open-task list. App-aware markup
// only: every rule it drives lives in `ui/utils/taskFilter`, and the state it
// edits is owned by `useTaskListFilter`. Rendered by the Clients, To-dos and day
// views, which is why the query box takes its accessible name from the caller —
// two of these can share a page.

import React, { useState } from 'react';
import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon, SearchIcon } from 'lucide-react';
import { Chip, IconButton, Input, LinkButton, Select } from '../primitives';
import { TASK_SORTS, type TaskSortDirection, type TaskSortKey, type TaskTagCount } from '../utils';

/** How many tag chips show before the row collapses behind "+n more". Selected
 *  tags are never hidden — a filter has to be switchable off where it went on. */
const TAG_CHIP_LIMIT = 8;

/** One status the list can be narrowed to, with what picking it would leave. */
export interface TaskStatusOption {
  id: string;
  label: string;
  count: number;
}

export interface TaskListToolbarProps {
  /** Names the controls — "open tasks", "to-dos", "worked tasks". */
  label: string;
  query: string;
  onQuery: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  /** `null` for a list whose status carries no information (general to-dos),
   *  which hides the control rather than offering a filter that says nothing. */
  statusOptions: TaskStatusOption[] | null;
  tags: TaskTagCount[];
  onToggleTag: (tag: string) => void;
  sort: TaskSortKey;
  onSort: (v: TaskSortKey) => void;
  dir: TaskSortDirection;
  onToggleDir: () => void;
  /** Something deviates from the defaults — sort included. Shows Reset. */
  dirty: boolean;
  onReset: () => void;
  /** A filter is hiding rows. Shows the "n of m" count. */
  filtered: boolean;
  count: number;
  total: number;
}

export function TaskListToolbar({
  label,
  query,
  onQuery,
  status,
  onStatus,
  statusOptions,
  tags,
  onToggleTag,
  sort,
  onSort,
  dir,
  onToggleDir,
  dirty,
  onReset,
  filtered,
  count,
  total,
}: TaskListToolbarProps) {
  const [allTagsShown, setAllTagsShown] = useState(false);
  const visibleTags = allTagsShown ? tags : tags.filter((t, i) => i < TAG_CHIP_LIMIT || t.selected);
  const hiddenTagCount = tags.length - visibleTags.length;
  const statusCount = statusOptions?.reduce((n, o) => n + o.count, 0) ?? 0;

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          clearable
          onClear={() => onQuery('')}
          clearLabel={`Clear ${label} filter`}
          leading={<SearchIcon size={14} className="shrink-0 text-neutral-650" />}
          aria-label={`Filter ${label}`}
          placeholder="Filter by title, tag, link..."
          className="flex-1 min-w-[180px]"
          inputClassName="text-input-fg"
        />

        {statusOptions && (
          <Select size="sm" value={status} onChange={(e) => onStatus(e.target.value)} aria-label={`Filter ${label} by status`}>
            <option value="">All statuses ({statusCount})</option>
            {statusOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({o.count})
              </option>
            ))}
          </Select>
        )}

        <Select size="sm" value={sort} onChange={(e) => onSort(e.target.value as TaskSortKey)} aria-label={`Sort ${label}`}>
          {TASK_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </Select>

        <IconButton
          size="sm"
          variant="outline"
          onClick={onToggleDir}
          aria-label={dir === 'asc' ? `Sort ${label} descending` : `Sort ${label} ascending`}
          title={dir === 'asc' ? 'Ascending — switch to descending' : 'Descending — switch to ascending'}
        >
          {dir === 'asc' ? <ArrowUpNarrowWideIcon size={15} /> : <ArrowDownWideNarrowIcon size={15} />}
        </IconButton>

        {filtered && (
          <span className="text-chip text-neutral-675 tabular-nums">
            {count} of {total}
          </span>
        )}

        {dirty && (
          <LinkButton onClick={onReset} className="px-1">
            Reset
          </LinkButton>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {visibleTags.map((t) => (
            <Chip
              key={t.tag}
              selected={t.selected}
              onClick={() => onToggleTag(t.tag)}
              title={t.selected ? `Stop filtering by "${t.tag}"` : `Filter by "${t.tag}"`}
            >
              {t.tag}
              <span className={'text-eyebrow tabular-nums ' + (t.selected ? 'text-brand-650' : 'text-neutral-625')}>
                {t.count}
              </span>
            </Chip>
          ))}
          {hiddenTagCount > 0 && (
            <LinkButton onClick={() => setAllTagsShown(true)} className="px-1">
              +{hiddenTagCount} more
            </LinkButton>
          )}
        </div>
      )}
    </div>
  );
}
