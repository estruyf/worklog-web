// Reusable checklists: the packing list you run every trip, the steps of a
// release, the invoicing routine. Each is a file under `lists/` and each is a
// thing you tick through, start again, and still have next time.
//
// One list is open at a time. A checklist is something you work down while you
// are doing the thing it describes — you are packing, or releasing — so the view
// is that one list, with the others waiting as a stack of names above and below
// it. It also means a phone shows one list's items rather than five lists'.
//
// Nothing here reaches the day, the ledger or a client: an item is not work, and
// a list has no dates beyond the day its last run finished.

import React, { useState } from 'react';
import { CheckIcon, EllipsisIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import type { Checklist, ChecklistItem, ChecklistSection } from '../../model/checklist';
import { checklistProgress } from '../../model/checklist';
import { DisclosureIcon } from '../components';
import { Button, Card, EmptyState, Input, LinkButton, Menu, SectionLabel, ViewHeader } from '../primitives';
import { useData } from '../context';
import { fmtShort } from '../utils';

/** A one-line editor that commits on ↵ and abandons on Esc. Both the item rows
 *  and the two "name it" fields are this: a checklist is a thing you type into
 *  quickly, and a Save button beside every row would be most of the view. */
function InlineInput({
  value,
  placeholder,
  label,
  onCommit,
  onCancel,
  autoFocus = true,
}: {
  value?: string;
  placeholder?: string;
  label: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value ?? '');
  const commit = () => {
    const words = text.trim();
    if (words) {
      onCommit(words);
    } else {
      onCancel();
    }
  };
  return (
    <Input
      autoFocus={autoFocus}
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      // Clicking away is a commit, not a discard: the row is gone either way and
      // silently throwing the words away is the surprising half of the two.
      onBlur={commit}
    />
  );
}

/** One tickable line. The circle and the words are one control — the whole row
 *  toggles, the way a checkbox and its label do — with the overflow menu holding
 *  the two things that aren't ticking. */
function ItemRow({ list, item }: { list: Checklist; item: ChecklistItem }) {
  const { toggleItem, renameItem, deleteItem } = useData();
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <div className="py-[5px] px-2.5">
        <InlineInput
          value={item.text}
          label={`Rename “${item.text}”`}
          onCommit={(text) => {
            setRenaming(false);
            void renameItem(list, item, text);
          }}
          onCancel={() => setRenaming(false)}
        />
      </div>
    );
  }

  return (
    <div className="group/item flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-175">
      <button
        onClick={() => void toggleItem(list, item)}
        aria-pressed={item.done}
        aria-label={item.done ? `Untick ${item.text}` : `Tick off ${item.text}`}
        title={item.done ? 'Put it back' : 'Tick it off'}
        className={
          'w-[16px] h-[16px] shrink-0 rounded-full cursor-pointer p-0 flex items-center justify-center ' +
          (item.done
            ? 'bg-success-500 border-[1.5px] border-success-500 text-white'
            : 'bg-white border-[1.5px] border-neutral-575 text-neutral-500 hover:border-success-500 hover:text-success-500')
        }
      >
        <CheckIcon size={10} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => void toggleItem(list, item)}
        className={
          'text-body flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer ' +
          (item.done ? 'line-through decoration-neutral-550 text-neutral-700' : 'text-neutral-825')
        }
      >
        {item.text}
      </button>
      <Menu
        kind="action"
        align="end"
        label={`Actions for “${item.text}”`}
        options={[
          { id: 'rename', label: 'Rename' },
          { id: 'delete', label: 'Delete' },
        ]}
        onSelect={(id) => (id === 'rename' ? setRenaming(true) : void deleteItem(list, item))}
        className="w-7 h-7 -my-1 shrink-0 flex items-center justify-center rounded-lg text-neutral-625 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 group-focus-within/item:opacity-100 hover:text-neutral-825 hover:bg-neutral-250"
      >
        <EllipsisIcon size={16} />
      </Menu>
    </div>
  );
}

/** The way to add to a section: a quiet line that becomes the input when you
 *  reach for it, and stays open afterwards so a list can be typed in one go. */
function AddItemRow({ list, sectionIndex }: { list: Checklist; sectionIndex: number }) {
  const { addItem } = useData();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-[7px] w-full py-2 px-2.5 rounded-lg bg-transparent border-none cursor-pointer text-control text-neutral-650 hover:text-neutral-825 hover:bg-neutral-175"
      >
        <PlusIcon size={14} />
        Add item
      </button>
    );
  }
  return (
    <div className="py-[5px] px-2.5">
      {/* Keyed by how many items the section holds, so committing one remounts
          the field: it stays open and focused for the next item, but empty. The
          input owns its text, and a component that stays mounted would offer the
          words you just added back as the next thing you are typing. */}
      <InlineInput
        key={list.sections[sectionIndex]?.items.length ?? 0}
        label="New item"
        placeholder="What needs doing?"
        onCommit={(text) => void addItem(list, sectionIndex, text)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

/** A `## ` group. An untitled one — the run of items a flat list is, or the ones
 *  sitting above the first heading — renders as those items and nothing else: it
 *  has no heading to rename, delete, or leave an empty label behind. */
function SectionBlock({ list, section, index }: { list: Checklist; section: ChecklistSection; index: number }) {
  const { renameSection, deleteSection } = useData();
  const [renaming, setRenaming] = useState(false);

  return (
    <div className={index > 0 ? 'mt-4' : ''}>
      {section.title &&
        (renaming ? (
          <div className="py-[5px] px-2.5 mb-[2px]">
            <InlineInput
              value={section.title}
              label={`Rename “${section.title}”`}
              onCommit={(title) => {
                setRenaming(false);
                void renameSection(list, section, title);
              }}
              onCancel={() => setRenaming(false)}
            />
          </div>
        ) : (
          <div className="group/section flex items-center gap-2 px-2.5 mb-[6px]">
            <SectionLabel className="flex-1 min-w-0 truncate">{section.title}</SectionLabel>
            <span className="text-meta text-neutral-625 tabular-nums shrink-0">
              {section.items.filter((i) => i.done).length}/{section.items.length}
            </span>
            <Menu
              kind="action"
              align="end"
              label={`Actions for “${section.title}”`}
              options={[
                { id: 'rename', label: 'Rename section' },
                { id: 'delete', label: 'Delete section' },
              ]}
              onSelect={(id) => (id === 'rename' ? setRenaming(true) : void deleteSection(list, section))}
              className="w-6 h-6 -my-1 shrink-0 flex items-center justify-center rounded-lg text-neutral-625 opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 group-focus-within/section:opacity-100 hover:text-neutral-825 hover:bg-neutral-250"
            >
              <EllipsisIcon size={15} />
            </Menu>
          </div>
        ))}
      {section.items.map((item) => (
        <ItemRow key={`${item.line}-${item.text}`} list={list} item={item} />
      ))}
      <AddItemRow list={list} sectionIndex={index} />
    </div>
  );
}

/** The way to group a list that has outgrown being one run of items. Sits under
 *  the last section because that is where the new one lands — a list is worked
 *  through in the order it is written. */
function AddSectionRow({ list }: { list: Checklist }) {
  const { addSection } = useData();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-[7px] mt-4 py-2 px-2.5 rounded-lg bg-transparent border-none cursor-pointer text-control text-neutral-650 hover:text-neutral-825 hover:bg-neutral-175"
      >
        <PlusIcon size={14} />
        Add section
      </button>
    );
  }
  return (
    <div className="mt-4 py-[5px] px-2.5">
      <InlineInput
        label="New section"
        placeholder="Bike, Clothes, Electronics…"
        onCommit={(title) => {
          setOpen(false);
          void addSection(list, title);
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

/** How far through the run this list is, as the number and as the bar. */
function Progress({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex items-center gap-2 shrink-0" title={`${done} of ${total} ticked off`}>
      <span className="hidden sm:block w-[52px] h-[4px] rounded-full bg-neutral-300 overflow-hidden">
        <span
          className="block h-full rounded-full bg-success-500"
          style={{ width: total ? `${Math.round((done / total) * 100)}%` : '0%' }}
        />
      </span>
      <span className="text-control text-neutral-675 tabular-nums">
        {done}/{total}
      </span>
    </span>
  );
}

/** One list: its header always, its items when it is the open one. */
function ListCard({ list, open, onOpen }: { list: Checklist; open: boolean; onOpen: () => void }) {
  const { renameList, deleteList, startAgain } = useData();
  const [renaming, setRenaming] = useState(false);
  const { done, total } = checklistProgress(list);

  return (
    <Card padding="list" className="mb-3">
      <div className="flex items-center gap-3 px-2.5 py-1.5">
        {renaming ? (
          <div className="flex-1">
            <InlineInput
              value={list.name}
              label={`Rename “${list.name}”`}
              onCommit={(name) => {
                setRenaming(false);
                void renameList(list.id, name);
              }}
              onCancel={() => setRenaming(false)}
            />
          </div>
        ) : (
          <>
            <button
              onClick={onOpen}
              aria-expanded={open}
              className="group flex items-center gap-2 flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer text-left"
            >
              <DisclosureIcon open={open} size={10} />
              <span className="text-row font-semibold truncate group-hover:text-neutral-900">{list.name}</span>
            </button>
            <Progress done={done} total={total} />
            {/* Only once something is ticked: on an untouched list the button
                would do nothing but stamp a run that never happened. */}
            {done > 0 && (
              <Button size="xs" onClick={() => void startAgain(list)} title="Untick everything and record this run as finished">
                <RotateCcwIcon size={12} />
                <span className="hidden sm:inline">Start again</span>
              </Button>
            )}
            <Menu
              kind="action"
              align="end"
              label={`Actions for “${list.name}”`}
              options={[
                { id: 'rename', label: 'Rename list' },
                { id: 'delete', label: 'Delete list' },
              ]}
              onSelect={(id) => (id === 'rename' ? setRenaming(true) : void deleteList(list))}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-neutral-625 hover:text-neutral-825 hover:bg-neutral-250"
            >
              <EllipsisIcon size={16} />
            </Menu>
          </>
        )}
      </div>

      {open && (
        <div className="mt-1 pb-1">
          {list.sections.map((section, i) => (
            <SectionBlock key={section.line ?? `flat-${i}`} list={list} section={section} index={i} />
          ))}
          <AddSectionRow list={list} />
          {/* The stamp sits under the list rather than in the header: it is the
              answer to "when did I last do this", which is a thing you look up
              once you are already in the list. */}
          {list.lastRun && (
            <div className="px-2.5 pt-3 text-meta text-neutral-650">Last run {fmtShort(list.lastRun)}</div>
          )}
        </div>
      )}
    </Card>
  );
}

export function ListsView() {
  const { checklists, createList } = useData();
  // One open at a time, and a repo with a single list opens on it: there is
  // nothing to choose between.
  const [openId, setOpenId] = useState<string | null>(checklists.length === 1 ? checklists[0].id : null);
  const [naming, setNaming] = useState(false);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-[10px]">
          <h1 className="text-[24px] font-bold m-0">Lists</h1>
          <span className="text-control text-neutral-675">
            {checklists.length === 1 ? '1 list' : `${checklists.length} lists`}
          </span>
        </div>
        <span className="shrink-0">
          <Button variant="primary" size="md" onClick={() => setNaming(true)} disabled={naming}>
            <PlusIcon size={15} />
            New list
          </Button>
        </span>
      </ViewHeader>

      <div className="flex-1 overflow-auto px-6 pt-6 pb-10">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {naming && (
            <Card padding="list" className="mb-3">
              <div className="px-2.5 py-1.5">
                <InlineInput
                  label="Name of the new list"
                  placeholder="Cycling trip, Release, Invoicing…"
                  onCommit={async (name) => {
                    setNaming(false);
                    // Awaited so the list it creates is the one that opens —
                    // the store has to have rebuilt before there is an id.
                    const created = await createList(name);
                    if (created) {
                      setOpenId(created.id);
                    }
                  }}
                  onCancel={() => setNaming(false)}
                />
              </div>
            </Card>
          )}

          {checklists.length === 0 && !naming ? (
            <EmptyState>
              No lists yet. A list is a checklist you reuse — what to pack, the steps of a release, the invoicing
              routine — that you tick through and then start again.{' '}
              <LinkButton size="inherit" onClick={() => setNaming(true)} className="italic underline">
                Make one
              </LinkButton>
            </EmptyState>
          ) : (
            checklists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                open={openId === list.id}
                onOpen={() => setOpenId(openId === list.id ? null : list.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
