// The phone half of the control bar: the two bottom sheets that stand in for the
// dropdowns when the card is too narrow to hold them. Same state, same
// vocabulary — `TaskListToolbar` owns both, and nothing here reads context.

import React from 'react';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon } from 'lucide-react';
import { Button, cn, LinkButton, Modal, SectionLabel } from '../../primitives';
import { sortDirectionLabels, TASK_SORTS, type TaskSortDirection, type TaskSortKey, type TaskTagCount } from '../../utils';
import { ANY, type TaskStatusOption } from './facets';

/** One line of a sheet's list: a full-width tap target rather than the menu row
 *  it replaces, since a thumb is what picks it. */
function SheetRow({
  label,
  meta,
  selected,
  onClick,
  role = 'menuitemradio',
}: {
  label: string;
  meta?: string;
  selected: boolean;
  onClick: () => void;
  /** `menuitemcheckbox` for the tags, which are a set rather than a choice. */
  role?: 'menuitemradio' | 'menuitemcheckbox';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-[13px] py-[11px] rounded-panel border-none cursor-pointer text-left text-body',
        selected ? 'bg-brand-175 text-brand-650 font-semibold' : 'bg-transparent text-neutral-825',
      )}
    >
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {meta && <span className="shrink-0 text-meta text-neutral-650 tabular-nums">{meta}</span>}
      <span className="w-[16px] shrink-0 text-brand-575" aria-hidden="true">
        {selected && <CheckIcon size={16} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

/** A facet's heading plus its "all of them" row and its options. */
function SheetFacet({
  title,
  anyLabel,
  value,
  options,
  onSelect,
}: {
  title: string;
  anyLabel: string;
  value: string;
  options: TaskStatusOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <SectionLabel className="mt-4 mb-1 px-[13px]">{title}</SectionLabel>
      {/* Grouped, because one menu holds three facets and the radios in each are
          a choice among themselves, not among all of them. */}
      <div role="group" aria-label={title}>
        <SheetRow label={anyLabel} selected={value === ANY} onClick={() => onSelect(ANY)} />
        {options.map((o) => (
          <SheetRow
            key={o.id}
            label={o.label}
            meta={String(o.count)}
            selected={value === o.id}
            onClick={() => onSelect(o.id)}
          />
        ))}
      </div>
    </>
  );
}

export function FilterSheet({
  onClose,
  client,
  onClient,
  clientOptions,
  status,
  onStatus,
  statusOptions,
  priority,
  onPriority,
  priorityOptions,
  tags,
  onToggleTag,
  dirty,
  onReset,
}: {
  onClose: () => void;
  client: string;
  onClient: (v: string) => void;
  clientOptions: TaskStatusOption[] | null;
  status: string;
  onStatus: (v: string) => void;
  statusOptions: TaskStatusOption[] | null;
  priority: string;
  onPriority: (v: string) => void;
  priorityOptions: TaskStatusOption[] | null;
  tags: TaskTagCount[];
  onToggleTag: (tag: string) => void;
  dirty: boolean;
  onReset: () => void;
}) {
  return (
    // The sheet stays up as filters are picked: narrowing is usually two or three
    // choices, and it is the list behind it — still visible — that shows the
    // result. Closing is the backdrop, Escape, or Done.
    <Modal placement="sheet" onClose={onClose} label="Filters" padding="md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] leading-[1.35] font-bold m-0">Filters</h2>
        {dirty && (
          <LinkButton size="md" onClick={onReset}>
            Clear all
          </LinkButton>
        )}
      </div>

      <div className="-mx-1" role="menu" aria-label="Filters">
        {clientOptions && (
          <SheetFacet title="Client" anyLabel="All clients" value={client} options={clientOptions} onSelect={onClient} />
        )}
        {statusOptions && (
          <SheetFacet title="Status" anyLabel="All statuses" value={status} options={statusOptions} onSelect={onStatus} />
        )}
        {priorityOptions && (
          <SheetFacet
            title="Priority"
            anyLabel="All priorities"
            value={priority}
            options={priorityOptions}
            onSelect={onPriority}
          />
        )}
        {tags.length > 0 && (
          <>
            <SectionLabel className="mt-4 mb-1 px-[13px]">Tags</SectionLabel>
            <div role="group" aria-label="Tags">
              {tags.map((t) => (
                <SheetRow
                  key={t.tag}
                  role="menuitemcheckbox"
                  label={t.tag}
                  meta={String(t.count)}
                  selected={t.selected}
                  onClick={() => onToggleTag(t.tag)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Button variant="primary" size="lg" onClick={onClose} className="w-full mt-5">
        Done
      </Button>
    </Modal>
  );
}

export function SortSheet({
  onClose,
  sort,
  onSort,
  defaultSortKey,
  dir,
  onToggleDir,
  onSaveDefault,
}: {
  onClose: () => void;
  sort: TaskSortKey;
  onSort: (v: TaskSortKey) => void;
  defaultSortKey: TaskSortKey;
  dir: TaskSortDirection;
  onToggleDir: () => void;
  onSaveDefault: (() => void) | null;
}) {
  const labels = sortDirectionLabels(sort);
  const DirIcon = dir === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <Modal placement="sheet" onClose={onClose} label="Sort by" padding="md">
      <h2 className="text-[17px] leading-[1.35] font-bold m-0">Sort by</h2>

      <div className="-mx-1 mt-2" role="menu" aria-label="Sort by">
        {TASK_SORTS.map((s) => (
          <SheetRow
            key={s.key}
            label={s.label}
            meta={s.key === defaultSortKey ? 'Default' : undefined}
            selected={s.key === sort}
            onClick={() => {
              onSort(s.key);
              onClose();
            }}
          />
        ))}
      </div>

      <Button variant="secondary" size="lg" onClick={onToggleDir} className="w-full mt-3">
        {dir === 'asc' ? labels.desc : labels.asc}
        <DirIcon size={15} strokeWidth={2} />
      </Button>
      {onSaveDefault && (
        <LinkButton
          size="md"
          onClick={() => {
            onSaveDefault();
            onClose();
          }}
          className="w-full mt-4"
        >
          Save as the default order
        </LinkButton>
      )}
    </Modal>
  );
}
