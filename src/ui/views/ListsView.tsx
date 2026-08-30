// Reusable checklists: the packing list you run every trip, the steps of a
// release, the invoicing routine. Each is a file under `lists/` and each is a
// thing you tick through, start again, and still have next time.
//
// The view has two states and no third: a board of tiles, one per list, and one
// list open across the whole pane. A checklist is something you work down while
// you are doing the thing it describes — you are packing, or releasing — so the
// open list gets the pane to itself, and the board is only how you pick it. The
// tiles carry no actions for the same reason the stack of expandable cards they
// replace didn't work: ten rows of menu, progress bar and "start again" is ten
// copies of one row, and the list you are actually running is lost among them.
// So progress is a ring you can read at a glance, and what you are mid-way
// through floats to a strip on top with the next item on it.
//
// Nothing here reaches the day, the ledger or a client: an item is not work, and
// a list has no dates beyond the day its last run finished.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, EllipsisIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import type { Checklist, ChecklistItem, ChecklistSection } from '../../model/checklist';
import { checklistItems, checklistProgress } from '../../model/checklist';
import { Button, EmptyState, Input, LinkButton, Menu, SectionLabel, ViewHeader } from '../primitives';
import type { MenuOption } from '../primitives';
import { useData } from '../context';
import { closeList, navigateToList, replaceWithLists, useOpenListId } from '../router';
import { fmtShort } from '../utils';

/** Where a dragged item would land: a section, and the position among its items.
 *  The same coordinates `moveItem` takes, so the drop is the call. */
interface DropTarget {
  sectionIndex: number;
  index: number;
}

/** The drag in progress, threaded down from the card because a drag crosses
 *  sections — the row being dragged and the row being dropped on are in two
 *  different `SectionBlock`s as often as not. */
interface DragState {
  /** The line of the item being dragged, or null when nothing is. */
  line: number | null;
  target: DropTarget | null;
  start: (line: number) => void;
  over: (target: DropTarget) => void;
  end: () => void;
  drop: () => void;
}

/** The row overflow menus are hover-revealed on a pointer and always there on a
 *  phone, which has no hover to reveal them with. Without this the only actions
 *  a touch device can reach are ticking and adding. */
const TOUCH_MENU =
  'opacity-100 sm:opacity-0 sm:focus-visible:opacity-100 hover:text-neutral-825 hover:bg-neutral-250';

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
      // Width is layout, so it belongs to the call site — see `CONTROL_BASE`.
      // Every one of these stands in a row of its own and should fill it.
      className="w-full"
    />
  );
}

/** The line a dragged item would drop onto. */
function DropLine() {
  return <div className="h-[2px] mx-2.5 my-[3px] rounded-full bg-brand-500" aria-hidden="true" />;
}

/** One tickable line. The circle and the words are one control — the whole row
 *  toggles, the way a checkbox and its label do — with the overflow menu holding
 *  everything that isn't ticking.
 *
 *  The row is a drag source and a drop target both. Dropping on its top half
 *  means "before this one", the bottom half "after" — so an insertion between
 *  two rows can be aimed at from either side of the gap. */
function ItemRow({
  list,
  item,
  sectionIndex,
  index,
  drag,
}: {
  list: Checklist;
  item: ChecklistItem;
  sectionIndex: number;
  index: number;
  drag: DragState;
}) {
  const { toggleItem, renameItem, deleteItem, moveItem } = useData();
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

  const section = list.sections[sectionIndex];
  const options: MenuOption[] = [{ id: 'rename', label: 'Rename' }];
  // Omitted rather than greyed out at the ends of a section: a menu of four
  // where two never do anything reads as broken.
  if (index > 0) {
    options.push({ id: 'up', label: 'Move up' });
  }
  if (index < section.items.length - 1) {
    options.push({ id: 'down', label: 'Move down' });
  }
  // The touch half of a drag: dragging works with a mouse and not with a thumb,
  // and moving an item between groups is exactly what a phone is holding the
  // list for.
  list.sections.forEach((s, i) => {
    if (i !== sectionIndex && s.title) {
      options.push({ id: `to:${i}`, label: `Move to “${s.title}”` });
    }
  });
  options.push({ id: 'delete', label: 'Delete' });

  const onSelect = (id: string) => {
    if (id === 'rename') {
      setRenaming(true);
    } else if (id === 'delete') {
      void deleteItem(list, item);
    } else if (id === 'up') {
      void moveItem(list, item, sectionIndex, index - 1);
    } else if (id === 'down') {
      // Past the next item, which is two slots along in the list as it stands.
      void moveItem(list, item, sectionIndex, index + 2);
    } else if (id.startsWith('to:')) {
      const to = Number(id.slice(3));
      void moveItem(list, item, to, list.sections[to].items.length);
    }
  };

  const dragging = drag.line === item.line;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        // Firefox starts no drag at all without something on the transfer.
        e.dataTransfer.setData('text/plain', item.text);
        drag.start(item.line);
      }}
      onDragEnd={drag.end}
      onDragOver={(e) => {
        if (drag.line === null) {
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const box = e.currentTarget.getBoundingClientRect();
        drag.over({ sectionIndex, index: e.clientY > box.top + box.height / 2 ? index + 1 : index });
      }}
      onDrop={(e) => {
        e.preventDefault();
        drag.drop();
      }}
      className={
        'group/item flex items-center gap-[11px] py-2 px-2.5 rounded-lg hover:bg-neutral-175 ' +
        (dragging ? 'opacity-40' : '')
      }
    >
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
        options={options}
        onSelect={onSelect}
        className={`w-7 h-7 -my-1 shrink-0 flex items-center justify-center rounded-lg text-neutral-625 sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100 ${TOUCH_MENU}`}
      >
        <EllipsisIcon size={16} />
      </Menu>
    </div>
  );
}

/** The way to add to a section: a quiet line that becomes the input when you
 *  reach for it, and stays open afterwards so a list can be typed in one go. */
function AddItemRow({
  list,
  sectionIndex,
  startOpen = false,
}: {
  list: Checklist;
  sectionIndex: number;
  /** Already open on mount: the first item of a list is typed into the empty
   *  card's own field, and that field is gone by the time this row appears. */
  startOpen?: boolean;
}) {
  const { addItem } = useData();
  const [open, setOpen] = useState(startOpen);

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
 *  has no heading to rename, delete, move, or leave an empty label behind. */
function SectionBlock({
  list,
  section,
  index,
  firstTitled,
  drag,
  startOpen,
}: {
  list: Checklist;
  section: ChecklistSection;
  index: number;
  /** Array position of the first group with a heading — where "move up" runs out. */
  firstTitled: number;
  drag: DragState;
  startOpen?: boolean;
}) {
  const { renameSection, deleteSection, moveSection } = useData();
  const [renaming, setRenaming] = useState(false);

  const options: MenuOption[] = [{ id: 'rename', label: 'Rename section' }];
  if (index > firstTitled) {
    options.push({ id: 'up', label: 'Move up' });
  }
  if (index < list.sections.length - 1) {
    options.push({ id: 'down', label: 'Move down' });
  }
  options.push({ id: 'delete', label: 'Delete section' });

  const onSelect = (id: string) => {
    if (id === 'rename') {
      setRenaming(true);
    } else if (id === 'delete') {
      void deleteSection(list, section);
    } else {
      void moveSection(list, section, id === 'up' ? -1 : 1);
    }
  };

  const at = (i: number) => drag.target?.sectionIndex === index && drag.target.index === i;
  return (
    <div
      className={index > 0 ? 'mt-4' : ''}
      // An empty group still has to be droppable, and it has no row to aim at.
      onDragOver={
        section.items.length === 0 && drag.line !== null
          ? (e) => {
              e.preventDefault();
              drag.over({ sectionIndex: index, index: 0 });
            }
          : undefined
      }
      onDrop={
        section.items.length === 0
          ? (e) => {
              e.preventDefault();
              drag.drop();
            }
          : undefined
      }
    >
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
          <div className="group/section flex items-center gap-2.5 px-2.5 mb-[6px]">
            <SectionLabel tone="faint" className="min-w-0 truncate">
              {section.title}
            </SectionLabel>
            {/* The rule carries the heading across to its count, so a group reads
                as one band rather than as a label with a number stranded on the
                far side of the row. */}
            <span className="flex-1 h-px bg-neutral-375" aria-hidden="true" />
            <span className="text-meta text-neutral-625 tabular-nums shrink-0">
              {section.items.filter((i) => i.done).length}/{section.items.length}
            </span>
            <Menu
              kind="action"
              align="end"
              label={`Actions for “${section.title}”`}
              options={options}
              onSelect={onSelect}
              className={`w-6 h-6 -my-1 shrink-0 flex items-center justify-center rounded-lg text-neutral-625 sm:group-hover/section:opacity-100 sm:group-focus-within/section:opacity-100 ${TOUCH_MENU}`}
            >
              <EllipsisIcon size={15} />
            </Menu>
          </div>
        ))}
      {section.items.map((item, i) => (
        <React.Fragment key={`${item.line}-${item.text}`}>
          {at(i) && <DropLine />}
          <ItemRow list={list} item={item} sectionIndex={index} index={i} drag={drag} />
        </React.Fragment>
      ))}
      {at(section.items.length) && <DropLine />}
      <AddItemRow list={list} sectionIndex={index} startOpen={startOpen} />
    </div>
  );
}

/** The way to group a list that has outgrown being one run of items. Sits under
 *  the last section because that is where the new one lands — a list is worked
 *  through in the order it is written.
 *
 *  Under a rule, and dashed rather than one more quiet grey line: it was the
 *  same shape as the "Add item" under every section, so on a list with anything
 *  on it the two read as the same control and this one looked like an "Add item"
 *  that had lost its heading. A dashed button is what the app already uses for
 *  starting a new container of things (a client, a prompt), which is what this
 *  is — the rule closes the list, and the button is plainly not part of it. */
function AddSectionRow({ list }: { list: Checklist }) {
  const { addSection } = useData();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 pt-3 px-2.5 border-t border-neutral-325">
      {open ? (
        <InlineInput
          label="New section"
          placeholder="Bike, Clothes, Electronics…"
          onCommit={(title) => {
            setOpen(false);
            void addSection(list, title);
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <Button variant="dashed" size="sm" onClick={() => setOpen(true)} className="w-full">
          <PlusIcon size={14} />
          Add section
        </Button>
      )}
    </div>
  );
}

/** What a list with nothing on it shows instead of its rows.
 *
 *  The two quiet "Add …" lines are the right shape once there is a list to add
 *  to, and the wrong one when the card is otherwise blank: two equal grey links
 *  under an empty box say nothing about which of them starts a list. So the
 *  empty card says what a list is for and offers the one obvious move, with
 *  grouping as the aside it is — you group a list you already have. */
function EmptyList({ list, onSeeded }: { list: Checklist; onSeeded: () => void }) {
  const { addItem, addSection } = useData();
  const [adding, setAdding] = useState<'item' | 'section' | null>(null);

  if (adding) {
    return (
      <div className="py-3 px-2.5">
        <InlineInput
          label={adding === 'item' ? 'New item' : 'New section'}
          placeholder={adding === 'item' ? 'What needs doing?' : 'Bike, Clothes, Electronics…'}
          onCommit={(text) => {
            if (adding === 'item') {
              // This card goes the moment the item lands — the list isn't empty
              // any more — so the ordinary rows take over. They come up with
              // their own field already open, which is what keeps the rest of
              // the list typeable in one go.
              onSeeded();
              void addItem(list, 0, text);
            } else {
              setAdding(null);
              void addSection(list, text);
            }
          }}
          onCancel={() => setAdding(null)}
        />
      </div>
    );
  }

  return (
    <div className="px-2.5 py-6 text-center">
      <p className="text-body text-neutral-750 m-0">Nothing on this list yet.</p>
      <p className="text-chip text-neutral-650 mt-[5px] mb-4">
        Add the things you tick off, then start it again next time.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="primary" size="sm" onClick={() => setAdding('item')}>
          <PlusIcon size={14} />
          Add item
        </Button>
        <LinkButton onClick={() => setAdding('section')}>or start with a section</LinkButton>
      </div>
    </div>
  );
}

/** How far through the run a list is, drawn as a ring with the percentage in it.
 *  A list nobody has started still draws it, empty: the ring is what makes "not
 *  started" readable across a grid of tiles, and hiding it would leave those
 *  tiles looking like they were missing something instead. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    // Decorative: every tile's `aria-label` already reads the same numbers out.
    <span
      aria-hidden="true"
      className="w-[34px] h-[34px] shrink-0 rounded-full flex items-center justify-center"
      style={{
        background: `conic-gradient(${pct === 100 ? 'var(--color-success-500)' : 'var(--color-brand-500)'} ${pct}%, var(--color-neutral-325) 0)`,
      }}
    >
      <span className="w-[26px] h-[26px] rounded-full bg-white flex items-center justify-center text-[9.5px] font-bold text-neutral-700 tabular-nums">
        {pct}
      </span>
    </span>
  );
}

/** When this list was last started over. */
function lastRunLabel(list: Checklist): string {
  return list.lastRun ? fmtShort(list.lastRun) : 'never run';
}

/** One list on the board: its name, how far through it is, and nothing you can
 *  act on. Every action a list has is one click away inside it — a menu and a
 *  "start again" on each of ten tiles is what made the stack they replace read
 *  as ten copies of the same row. */
function ListTile({ list, onOpen }: { list: Checklist; onOpen: () => void }) {
  const { done, total } = checklistProgress(list);
  return (
    <button
      data-tile={`all:${list.id}`}
      onClick={onOpen}
      aria-label={`${list.name}, ${done} of ${total} ticked`}
      className="flex flex-col gap-2.5 min-h-[104px] p-3.5 text-left rounded-xl border border-neutral-400 bg-white cursor-pointer hover:border-neutral-525 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex items-start gap-2 w-full">
        <span className="flex-1 min-w-0 text-[14px] font-semibold text-neutral-825 leading-tight line-clamp-2">
          {list.name}
        </span>
        <ProgressRing done={done} total={total} />
      </span>
      {/* Pushes the meta line onto the tile's bottom edge, so a row of tiles
          lines its dates up however long the names above them are. */}
      <span className="flex-1" />
      <span className="flex items-center gap-1.5 text-[11.5px] text-neutral-650">
        <span className="tabular-nums">{total === 1 ? '1 item' : `${total} items`}</span>
        <span className="w-[3px] h-[3px] rounded-full bg-neutral-550" aria-hidden="true" />
        {lastRunLabel(list)}
      </span>
    </button>
  );
}

/** A list you are part-way through, in the strip above the board. It carries the
 *  next unticked item, which is the one thing you would have opened it to find. */
function RunningTile({ list, onOpen }: { list: Checklist; onOpen: () => void }) {
  const { done, total } = checklistProgress(list);
  const next = checklistItems(list).find((i) => !i.done);
  return (
    <button
      data-tile={`running:${list.id}`}
      onClick={onOpen}
      aria-label={`${list.name}, ${done} of ${total} ticked`}
      className="flex items-center gap-3 p-3.5 text-left rounded-xl border border-brand-350 bg-brand-50 cursor-pointer hover:border-brand-425 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <ProgressRing done={done} total={total} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-neutral-825 leading-tight truncate">{list.name}</span>
        {next && <span className="block text-[12px] text-brand-625 truncate">Next: {next.text}</span>}
      </span>
    </button>
  );
}

/** Where a new list is named: the first cell of the grid, in the shape of the
 *  tile it is about to become. */
function NewListTile({ onCommit, onCancel }: { onCommit: (name: string) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col justify-center min-h-[104px] p-3.5 rounded-xl border border-dashed border-neutral-500 bg-white">
      <InlineInput
        label="Name of the new list"
        placeholder="Cycling trip, Release, Invoicing…"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    </div>
  );
}

/** The strip above an open list's items: how far this run has got, and the way
 *  to end it. */
function Meter({ list }: { list: Checklist }) {
  const { startAgain } = useData();
  const { done, total } = checklistProgress(list);
  return (
    <div className="flex items-center gap-2 px-2.5 pb-3">
      <span className="w-[100px] h-[5px] rounded-full bg-neutral-400 overflow-hidden">
        <span
          className="block h-full rounded-full bg-success-500"
          style={{ width: total ? `${Math.round((done / total) * 100)}%` : '0%' }}
        />
      </span>
      <span className="text-control text-neutral-675 tabular-nums">
        {done}/{total}
      </span>
      <span className="flex-1" />
      {/* Only once something is ticked: on an untouched list the button would do
          nothing but stamp a run that never happened. */}
      {done > 0 && (
        <Button size="xs" onClick={() => void startAgain(list)} title="Untick everything and record this run as finished">
          <RotateCcwIcon size={12} />
          Start again
        </Button>
      )}
    </div>
  );
}

/** The band above an open list: the way back to the board, which list this is,
 *  and everything that acts on the list as a whole. Those actions live here
 *  rather than on the tile — you rename, duplicate or delete a list you are
 *  looking at, not one you are scanning past. */
function OpenListHeader({ list, onBack }: { list: Checklist; onBack: () => void }) {
  const { renameList, deleteList, duplicateList } = useData();
  const [renaming, setRenaming] = useState(false);

  return (
    <ViewHeader className="max-w-[920px] xl:max-w-[1280px] flex items-center gap-3">
      <Button variant="neutral" size="xs" onClick={onBack} className="shrink-0">
        ‹ Lists
      </Button>
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
          <h1 className="text-[24px] font-bold m-0 truncate">{list.name}</h1>
          <span className="text-control text-neutral-675 shrink-0">
            {list.lastRun ? `last run ${fmtShort(list.lastRun)}` : 'never run'}
          </span>
          <span className="flex-1" />
          <Menu
            kind="action"
            align="end"
            label={`Actions for “${list.name}”`}
            options={[
              { id: 'rename', label: 'Rename list' },
              { id: 'duplicate', label: 'Duplicate', hint: 'A copy with nothing ticked' },
              { id: 'delete', label: 'Delete list' },
            ]}
            onSelect={(id) => {
              if (id === 'rename') {
                setRenaming(true);
              } else if (id === 'delete') {
                void deleteList(list);
              } else {
                // Open the copy: duplicating is how a run is started, and the
                // copy is the one you are about to work down.
                void duplicateList(list).then((made) => made && navigateToList(made.id));
              }
            }}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-neutral-625 hover:text-neutral-825 hover:bg-neutral-250"
          >
            <EllipsisIcon size={16} />
          </Menu>
        </>
      )}
    </ViewHeader>
  );
}

/** The open list itself. Everything below the meter is what the expanded card
 *  held — the sections, the drag that crosses them, both "add" rows — at reading
 *  width rather than the board's, which the tiles need and item rows don't. */
function OpenList({ list }: { list: Checklist }) {
  const { moveItem } = useData();
  // The first item of this list was typed into the empty pane, so the row that
  // replaces it opens its field rather than making you reach for it again.
  const [seeded, setSeeded] = useState(false);
  // The drag lives here rather than in a row: it starts in one section and ends
  // in another, and only this sees both.
  const [dragLine, setDragLine] = useState<number | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  const drag: DragState = {
    line: dragLine,
    target,
    start: setDragLine,
    over: (next) =>
      setTarget((prev) => (prev && prev.sectionIndex === next.sectionIndex && prev.index === next.index ? prev : next)),
    end: () => {
      setDragLine(null);
      setTarget(null);
    },
    drop: () => {
      const item = checklistItems(list).find((i) => i.line === dragLine);
      if (item && target) {
        void moveItem(list, item, target.sectionIndex, target.index);
      }
      setDragLine(null);
      setTarget(null);
    },
  };

  const empty = list.sections.length === 1 && !list.sections[0].title && list.sections[0].items.length === 0;
  const firstTitled = list.sections.findIndex((s) => s.title);

  return (
    <div className="max-w-[720px] mx-auto">
      <Meter list={list} />
      {empty ? (
        <EmptyList list={list} onSeeded={() => setSeeded(true)} />
      ) : (
        <>
          {list.sections.map((section, i) => (
            <SectionBlock
              key={section.line ?? `flat-${i}`}
              list={list}
              section={section}
              index={i}
              firstTitled={firstTitled}
              drag={drag}
              startOpen={seeded && i === 0}
            />
          ))}
          <AddSectionRow list={list} />
        </>
      )}
      {list.lastRun && (
        <div className="px-2.5 pt-3 text-meta text-neutral-650">Last run {fmtShort(list.lastRun)}</div>
      )}
    </div>
  );
}

/** Newest run first, and a list that has never been run last: the board is
 *  ordered by when you last did the thing, which is how you look for it. */
function byLastRun(a: Checklist, b: Checklist): number {
  return (b.lastRun ?? '').localeCompare(a.lastRun ?? '');
}

export function ListsView() {
  const { checklists, createList } = useData();
  // Which list is open lives in the URL and nowhere else — /app/lists/<id> is
  // what makes a half-ticked list survive a reload and be worth sending someone.
  const openId = useOpenListId();
  const [naming, setNaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Where the board was left, so coming back out of a list lands on the tile you
  // went in from rather than at the top of the grid.
  const boardScroll = useRef(0);
  // Which tile opened the list, to hand focus back to on the way out. The tile
  // itself is gone by then — the board unmounts — so it is found again by its
  // `data-tile`, and a list can have one in each band.
  const returnTo = useRef<string | null>(null);

  // A URL naming a list that isn't there: deleted here a moment ago, or deleted
  // on another device and synced in under you. The board is the honest answer,
  // and it is already the page you would go to next.
  useEffect(() => {
    if (openId !== null && !checklists.some((l) => l.id === openId)) {
      replaceWithLists();
    }
  }, [openId, checklists]);

  // Escape is the way out of a list, the same as the back control. Nothing else
  // in this view listens for it: the inline fields stop their own Escape before
  // it leaves the input.
  useEffect(() => {
    if (openId === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeList();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  // The board and the open list share one scroll box, so switching between them
  // has to place the scroll itself: back to where the board was, or the top of a
  // list you just opened. Focus comes after, without scrolling, so restoring the
  // position isn't undone by the tile scrolling itself into view.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) {
      return;
    }
    if (openId !== null) {
      box.scrollTop = 0;
      return;
    }
    box.scrollTop = boardScroll.current;
    if (returnTo.current) {
      const tile = box.querySelector(`[data-tile="${CSS.escape(returnTo.current)}"]`);
      returnTo.current = null;
      if (tile instanceof HTMLElement) {
        tile.focus({ preventScroll: true });
      }
    }
  }, [openId]);

  const openList = openId === null ? undefined : checklists.find((l) => l.id === openId);
  const open = (list: Checklist, band: 'running' | 'all') => {
    boardScroll.current = scrollRef.current?.scrollTop ?? 0;
    returnTo.current = `${band}:${list.id}`;
    navigateToList(list.id);
  };

  // Part-way through, and so the thing you are most likely here for.
  const running = checklists.filter((l) => {
    const { done, total } = checklistProgress(l);
    return done > 0 && done < total;
  });
  running.sort(byLastRun);
  const all = [...checklists].sort(byLastRun);

  if (openList) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <OpenListHeader list={openList} onBack={closeList} />
        <div ref={scrollRef} className="flex-1 overflow-auto px-6 pt-[18px] pb-6">
          <OpenList list={openList} />
        </div>
      </div>
    );
  }

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

      <div ref={scrollRef} className="flex-1 overflow-auto px-6 pt-[18px] pb-6">
        <div className="max-w-[920px] xl:max-w-[1280px] mx-auto">
          {checklists.length === 0 && !naming ? (
            <EmptyState>
              No lists yet. A list is a checklist you reuse — what to pack, the steps of a release, the invoicing
              routine — that you tick through and then start again.{' '}
              <LinkButton size="inherit" onClick={() => setNaming(true)} className="italic underline">
                Make one
              </LinkButton>
            </EmptyState>
          ) : (
            <>
              {running.length > 0 && (
                <div className="pb-5">
                  <SectionLabel tone="faint" className="pb-2">
                    Running now
                  </SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {running.map((list) => (
                      <RunningTile key={list.id} list={list} onOpen={() => open(list, 'running')} />
                    ))}
                  </div>
                </div>
              )}
              {/* Both headings go together when nothing is running: one grid with
                  nothing above it to contrast with doesn't need naming. */}
              {running.length > 0 && (
                <SectionLabel tone="faint" className="pb-2">
                  All lists
                </SectionLabel>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {naming && (
                  <NewListTile
                    onCommit={async (name) => {
                      setNaming(false);
                      // Awaited so the list it creates is the one that opens —
                      // the store has to have rebuilt before there is an id.
                      const created = await createList(name);
                      if (created) {
                        navigateToList(created.id);
                      }
                    }}
                    onCancel={() => setNaming(false)}
                  />
                )}
                {all.map((list) => (
                  <ListTile key={list.id} list={list} onOpen={() => open(list, 'all')} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
