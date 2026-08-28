// The one control bar an open-task list carries: search, the filter menus and the
// order, drawn as the top strip of the card the rows live in. The filters belong
// to the list under them, so they sit inside it — not in a floating row above a
// separate card, and not in a second line of tag chips.
//
// App-aware markup only: every rule it drives lives in `ui/utils/taskFilter`, and
// the state it edits is owned by `useTaskListFilter`. Rendered by the Clients,
// To-dos, Overdue, Upcoming and day views, which is why the query box takes its
// accessible name from the caller — two of these can share a page.

import React, { useMemo, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Badge, Button, cn, IconButton, Input, Menu, type MenuOption } from '../../primitives';
import { sortDirectionLabels, TASK_SORTS, type TaskSortDirection, type TaskSortKey, type TaskTagCount } from '../../utils';
import { ANY, type TaskStatusOption } from './facets';
import { FilterSheet, SortSheet } from './FilterSheets';

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
  priority: string;
  onPriority: (v: string) => void;
  /** `null` when nothing in the list has a priority set — the picker would then
   *  offer one option ("Normal") that changes nothing. */
  priorityOptions: TaskStatusOption[] | null;
  tags: TaskTagCount[];
  onToggleTag: (tag: string) => void;
  sort: TaskSortKey;
  onSort: (v: TaskSortKey) => void;
  /** The order every list opens in. Marks its option "Default" in the menu, so
   *  "Save as default" says what it would change. */
  defaultSortKey: TaskSortKey;
  dir: TaskSortDirection;
  onToggleDir: () => void;
  /** Saves the current order as the default for every list, or `null` when it
   *  already is the default. Writes config.json, so it's an explicit click
   *  rather than a side effect of the picker — the same order is often wanted
   *  for one look at one list. */
  onSaveDefault: (() => void) | null;
  /** Something deviates from the defaults — sort included. Shows Reset. */
  dirty: boolean;
  onReset: () => void;
  /** A filter is hiding rows. Shows the "n of m" count. */
  filtered: boolean;
  count: number;
  total: number;
  /** Where the bar is drawn. `card` is the common case — the strip at the top of
   *  the card the rows are in, pulled out to its edges and closed with a hairline.
   *  `page` is the grouped lists (a card per client): the bar stands on the page
   *  background above the cards, so it has no card edges to reach for. The search
   *  box is the app's ordinary bordered field either way — a borderless well read
   *  as decoration on the card and as nothing at all on the page. */
  surface?: 'card' | 'page';
}

/** The face of a filter trigger. Quiet until it is doing something: an unapplied
 *  filter is a word with a chevron, and only an *applied* one draws a box — four
 *  equal outlined controls made everything look equally important.
 *
 *  A span inside the `Menu`, not classes on the menu's own button: `cn` cannot
 *  reliably override the trigger's `border-none`, which is a border *style*. */
function TriggerFace({ on, marker, children }: { on: boolean; marker?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] max-w-[190px] px-[9px] py-[5px] rounded-control border text-control',
        on
          ? 'border-brand-500 bg-brand-175 text-brand-650 font-semibold'
          : 'border-transparent text-neutral-700 group-hover/trigger:bg-neutral-225 group-hover/trigger:text-neutral-825',
      )}
    >
      <span className="truncate">{children}</span>
      {marker && <span className="w-[6px] h-[6px] shrink-0 rounded-full bg-info" aria-hidden="true" />}
      <ChevronDownIcon size={12} strokeWidth={2.25} className="shrink-0 opacity-55" />
    </span>
  );
}

/** A borderless dropdown that narrows the list. One id at a time, `ANY` for
 *  "all of them" — which is an option in the list rather than a Clear button,
 *  so switching a filter off is where switching it on was. */
function FilterMenu({
  anyLabel,
  value,
  options,
  onSelect,
  label,
}: {
  anyLabel: string;
  value: string;
  options: TaskStatusOption[];
  onSelect: (id: string) => void;
  label: string;
}) {
  const menuOptions = useMemo<MenuOption[]>(
    () => [
      { id: ANY, label: anyLabel },
      ...options.map((o) => ({ id: o.id, label: o.label, meta: String(o.count) })),
    ],
    [anyLabel, options],
  );
  const current = options.find((o) => o.id === value);
  return (
    <Menu options={menuOptions} value={value} onSelect={onSelect} label={label} className="group/trigger shrink-0">
      <TriggerFace on={!!current}>{current?.label ?? anyLabel}</TriggerFace>
    </Menu>
  );
}

/** How the tag filter reads on its trigger. Several tags narrow conjunctively,
 *  so past the first one the count says more than a list of them would. */
function tagTriggerLabel(selected: string[]): string {
  if (selected.length === 0) {
    return 'Tags';
  }
  return selected.length === 1 ? selected[0] : `${selected.length} tags`;
}

export function TaskListToolbar({
  label,
  query,
  onQuery,
  status,
  onStatus,
  statusOptions,
  priority,
  onPriority,
  priorityOptions,
  tags,
  onToggleTag,
  sort,
  onSort,
  defaultSortKey,
  dir,
  onToggleDir,
  onSaveDefault,
  dirty,
  onReset,
  filtered,
  count,
  total,
  surface = 'card',
}: TaskListToolbarProps) {
  const onCard = surface === 'card';
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);

  const selectedTags = useMemo(() => tags.filter((t) => t.selected).map((t) => t.tag), [tags]);
  const tagOptions = useMemo<MenuOption[]>(
    () => tags.map((t) => ({ id: t.tag, label: t.tag, meta: String(t.count) })),
    [tags],
  );
  const sortOptions = useMemo<MenuOption[]>(
    () => TASK_SORTS.map((s) => ({ id: s.key, label: s.label, meta: s.key === defaultSortKey ? 'Default' : undefined })),
    [defaultSortKey],
  );

  const dirLabels = sortDirectionLabels(sort);
  const sortLabel = TASK_SORTS.find((s) => s.key === sort)?.label ?? sort;
  const dirTitle =
    dir === 'asc'
      ? `${dirLabels.asc} — switch to ${dirLabels.desc.toLowerCase()}`
      : `${dirLabels.desc} — switch to ${dirLabels.asc.toLowerCase()}`;
  const DirIcon = dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  // What the phone's one trigger has to stand in for, since the three menus it
  // replaces are not on screen to show their own state.
  const activeFilters = (status ? 1 : 0) + (priority ? 1 : 0) + selectedTags.length;

  // Both belong to the order, so they live under it rather than beside it: two
  // link buttons in the bar competed with the filters for a glance they had not
  // earned, and neither is reachable until something has been changed anyway.
  const sortFooter =
    onSaveDefault || dirty
      ? (close: () => void) => (
          <div className="flex items-center gap-1 px-1">
            {onSaveDefault && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSaveDefault();
                  close();
                }}
                title={`Open every list in this order from now on (${sortLabel} — ${(dir === 'asc' ? dirLabels.asc : dirLabels.desc).toLowerCase()})`}
                className="flex-1 px-[11px] py-[7px] rounded-control bg-transparent border-none cursor-pointer text-control font-semibold text-info hover:bg-neutral-200"
              >
                Save as default
              </button>
            )}
            {dirty && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onReset();
                  close();
                }}
                title="Clear the filters and go back to the default order"
                className="px-[11px] py-[7px] rounded-control bg-transparent border-none cursor-pointer text-control text-neutral-675 hover:bg-neutral-200"
              >
                Reset
              </button>
            )}
          </div>
        )
      : undefined;

  const sortControls = (
    <>
      {filtered && (
        <span className="shrink-0 text-chip text-neutral-675 tabular-nums">
          {count} of {total}
        </span>
      )}
      <Menu
        options={sortOptions}
        value={sort}
        onSelect={(id) => onSort(id as TaskSortKey)}
        label={`Sort ${label}`}
        align="end"
        footer={sortFooter}
        className="group/trigger shrink-0"
      >
        {/* The dot is the only thing left saying this list is not in the order
            every other one opens in — the words "Sort: Progress" cannot. */}
        <TriggerFace on={false} marker={!!onSaveDefault}>
          Sort: {sortLabel}
        </TriggerFace>
      </Menu>
      <IconButton
        onClick={onToggleDir}
        aria-label={dir === 'asc' ? `Sort ${label} descending` : `Sort ${label} ascending`}
        title={dirTitle}
      >
        <DirIcon size={15} strokeWidth={2} />
      </IconButton>
    </>
  );

  return (
    // On a card: pulled out to its edges so the strip spans it, then re-padded to
    // the rows' own inset — the search box lines up with the titles below it. On
    // the page: no inset at all, so the bar's left edge is the cards' left edge.
    <div
      className={cn(
        onCard ? '-mx-2 -mt-[6px] mb-[6px] px-2.5 py-2 border-b border-neutral-275' : 'mb-3',
      )}
    >
      {/* The container is this inner box and not the strip itself, for two
          reasons: an element with `container-type` carries layout containment, so
          the strip would be the containing block for the sheets' fixed backdrop —
          a bottom sheet docked to the bottom of the toolbar — and a container
          cannot answer its own queries, so the row/column switch has to sit on a
          child of it. */}
      <div className="@container">
        <div className="flex flex-col gap-2 @4xl:flex-row @4xl:items-center @4xl:gap-3">
          <Input
            size="sm"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            clearable
            onClear={() => onQuery('')}
            clearLabel={`Clear the ${label} search`}
            leading={<SearchIcon size={15} className="shrink-0 text-neutral-650" />}
            aria-label={`Search ${label}`}
            placeholder="Search tasks"
            className="@4xl:w-[320px] @4xl:shrink-0"
            inputClassName="text-input-fg"
          />

          {/* From @xl up the filters are their own controls — on a second line
              while the card is narrow, on the search box's line once there is room
              for both. */}
          <div className="hidden @xl:flex flex-1 min-w-0 items-center gap-1">
            <span className="hidden @4xl:block w-px h-5 mr-2 shrink-0 bg-neutral-400" aria-hidden="true" />
            {statusOptions && (
              <FilterMenu
                anyLabel="All statuses"
                value={status}
                options={statusOptions}
                onSelect={onStatus}
                label={`Filter ${label} by status`}
              />
            )}
            {priorityOptions && (
              <FilterMenu
                anyLabel="All priorities"
                value={priority}
                options={priorityOptions}
                onSelect={onPriority}
                label={`Filter ${label} by priority`}
              />
            )}
            {tags.length > 0 && (
              <Menu
                options={tagOptions}
                values={selectedTags}
                multiple
                onSelect={onToggleTag}
                label={`Filter ${label} by tag`}
                searchable={tags.length > 12}
                searchPlaceholder="Find a tag…"
                emptyText="No tags"
                className="group/trigger shrink-0"
              >
                <TriggerFace on={selectedTags.length > 0}>{tagTriggerLabel(selectedTags)}</TriggerFace>
              </Menu>
            )}
            <div className="ml-auto flex items-center gap-1">{sortControls}</div>
          </div>

          {/* Below @xl the three menus become one sheet: side by side they would be
              three truncated words, and a dropdown anchored to a 90px trigger is
              worse to hit than a list under the thumb. Sort stays out of it — it
              changes what is at the top of the list, which is what you came for. */}
          <div className="flex @xl:hidden items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => setSheet('filters')} className="flex-1">
              <SlidersHorizontalIcon size={14} />
              Filters
              {activeFilters > 0 && <Badge tone="brand" size="xs">{activeFilters}</Badge>}
            </Button>
            <Button variant="secondary" size="md" onClick={() => setSheet('sort')} className="flex-1 min-w-0">
              <span className="truncate">Sort: {sortLabel}</span>
            </Button>
            <IconButton
              variant="outline"
              onClick={onToggleDir}
              aria-label={dir === 'asc' ? `Sort ${label} descending` : `Sort ${label} ascending`}
              title={dirTitle}
            >
              <DirIcon size={15} strokeWidth={2} />
            </IconButton>
          </div>

          {filtered && (
            <span className="@xl:hidden text-chip text-neutral-675 tabular-nums">
              {count} of {total} shown
            </span>
          )}
        </div>
      </div>

      {sheet === 'filters' && (
        <FilterSheet
          onClose={() => setSheet(null)}
          status={status}
          onStatus={onStatus}
          statusOptions={statusOptions}
          priority={priority}
          onPriority={onPriority}
          priorityOptions={priorityOptions}
          tags={tags}
          onToggleTag={onToggleTag}
          dirty={dirty}
          onReset={onReset}
        />
      )}
      {sheet === 'sort' && (
        <SortSheet
          onClose={() => setSheet(null)}
          sort={sort}
          onSort={onSort}
          defaultSortKey={defaultSortKey}
          dir={dir}
          onToggleDir={onToggleDir}
          onSaveDefault={onSaveDefault}
        />
      )}
    </div>
  );
}
