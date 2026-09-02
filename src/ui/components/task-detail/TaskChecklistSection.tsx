// The task's own checklist: the two or three steps "done" actually involves,
// ticked off as you go. It is deliberately smaller than everything around it —
// a step has no client, no due date and no status, so it never reaches the day
// view, the ledger or an invoice. Something that needs any of those is a
// subtask, and the row above this one is where you make one.
//
// The steps live in a `### Checklist` section on the task (see
// `parser/taskParser`), so they are a plain GFM checkbox list in any Markdown
// viewer and ticking one there means what it means here.
//
// Only rendered once the task has a step or the add line is open — the way *in*
// to the first one is `TaskContentActions`, which is what sets `checklistComposing`.

import React, { useState } from 'react';
import { CheckIcon, EllipsisIcon, ListPlusIcon, PlusIcon } from 'lucide-react';
import type { Task, TaskChecklistItem } from '../../../model/types';
import { checklistItems } from '../../../model/checklist';
import { Button, Card, Input, Menu, SectionLabel } from '../../primitives';
import type { MenuOption } from '../../primitives';
import { useData, useUi } from '../../context';

/** Same treatment, and the same reason, as the list rows in `ListsView`: the row
 *  menu is hover-revealed on a pointer and always there on a phone. */
const TOUCH_MENU = 'opacity-100 sm:opacity-0 sm:group-hover/step:opacity-100 sm:focus-visible:opacity-100';

/** A one-line editor that commits on ↵ and abandons on Esc — the same control
 *  the Lists view types into, for the same reason: a checklist is written
 *  quickly, and a Save button beside every row would be most of the section. */
function StepInput({
  value,
  placeholder,
  label,
  onCommit,
  onCancel,
}: {
  value?: string;
  placeholder?: string;
  label: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
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
      autoFocus
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          // Closes the line, not the task panel — that listener sits on window
          // (see ../../WorklogApp).
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      // Clicking away commits: the line is gone either way, and throwing the
      // words away silently is the surprising half of the two.
      onBlur={commit}
      className="w-full"
    />
  );
}

/** One step: the circle and the words are one control, so ticking it off is the
 *  whole row rather than a 16px target. Renaming and removing sit in the row's
 *  menu — a step is one line, and a delete link on every one of them would be
 *  the loudest thing in the section. */
function Step({
  item,
  editing,
  onToggle,
  onEdit,
  onRename,
  onCancelEdit,
  onDelete,
}: {
  item: TaskChecklistItem;
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRename: (text: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const options: MenuOption[] = [
    { id: 'rename', label: 'Rename' },
    { id: 'delete', label: 'Delete' },
  ];
  if (editing) {
    return (
      <div className="py-[3px] px-1.5">
        <StepInput value={item.text} label={`Rename “${item.text}”`} onCommit={onRename} onCancel={onCancelEdit} />
      </div>
    );
  }
  return (
    <div className="group/step flex items-center gap-[9px] h-[28px] px-1.5 rounded-control hover:bg-neutral-175">
      <button
        type="button"
        onClick={onToggle}
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
        onClick={onToggle}
        className={
          'text-body leading-none truncate flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer ' +
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
        onSelect={(id) => (id === 'rename' ? onEdit() : onDelete())}
        className={`w-[22px] h-[22px] shrink-0 flex items-center justify-center rounded-control text-neutral-625 hover:text-neutral-825 hover:bg-neutral-250 ${TOUCH_MENU}`}
      >
        <EllipsisIcon size={15} />
      </Menu>
    </div>
  );
}

export function TaskChecklistSection({ task }: { task: Task }) {
  const { addChecklistSteps, setChecklistStepDone, renameChecklistStep, deleteChecklistStep, features, checklists } = useData();
  const { checklistComposing } = useUi();
  const items = task.checklist ?? [];
  const done = items.filter((i) => i.done).length;
  const [editing, setEditing] = useState<number | null>(null);
  // Whether the add line is a field or the quiet button that opens one. Local,
  // and deliberately *not* `checklistComposing`: closing the field must not
  // unmount the section, or clicking anything in the header — "From a list"
  // above all — would blur the field, take the section down with it, and lose
  // the click that was on its way to the menu. The flag from the content-action
  // row only says the block is open; from there this row is its own business.
  // Mounting coincides with that flag being set (the section renders nothing
  // before it), so it is the right thing to start from.
  const [adding, setAdding] = useState(checklistComposing);

  // A saved list is a checklist someone has already written down — the release
  // routine, the onboarding steps — so starting from one beats retyping it. The
  // items come across unticked and are the task's own from then on: this is a
  // copy, not a link, and ticking one here does nothing to the list.
  const startable = features.lists ? checklists.filter((l) => checklistItems(l).length > 0) : [];
  const listOptions: MenuOption[] = startable.map((l) => {
    const count = checklistItems(l).length;
    return { id: l.id, label: l.name, meta: `${count} ${count === 1 ? 'item' : 'items'}` };
  });
  const copyList = (id: string) => {
    const list = startable.find((l) => l.id === id);
    if (list) {
      addChecklistSteps(task.id, checklistItems(list).map((i) => i.text));
      setAdding(false);
    }
  };

  // Switched off in Settings the whole block goes — the `### Checklist` section
  // stays in the Markdown and comes back with the switch.
  if (!features.checklist || (items.length === 0 && !checklistComposing)) {
    return null;
  }

  return (
    <div className="mt-9 mb-7">
      <div className="flex items-center justify-between gap-3 mb-[10px]">
        <div className="flex items-baseline gap-2 min-w-0">
          <SectionLabel>Checklist</SectionLabel>
          {items.length > 0 && (
            <span className="truncate text-count text-neutral-650 tabular-nums">
              {done} of {items.length} done
            </span>
          )}
        </div>
        {listOptions.length > 0 && (
          <Menu
            align="end"
            label="Copy a list onto this task"
            title="Copy the items from one of your lists onto this task"
            options={listOptions}
            onSelect={copyList}
            className="shrink-0 inline-flex items-center gap-[6px] px-2 py-[5px] rounded-control border border-neutral-400 bg-white text-meta font-medium text-neutral-750 cursor-pointer hover:bg-neutral-200"
          >
            <ListPlusIcon size={13} />
            From a list
          </Menu>
        )}
      </div>

      <Card radius="panel" padding="list">
        <div className="flex flex-col">
          {items.map((item, index) => (
            <Step
              key={index}
              item={item}
              editing={editing === index}
              onToggle={() => setChecklistStepDone(task.id, index, !item.done)}
              onEdit={() => setEditing(index)}
              onRename={(text) => {
                renameChecklistStep(task.id, index, text);
                setEditing(null);
              }}
              onCancelEdit={() => setEditing(null)}
              onDelete={() => {
                // Every step after it shifts down one, so an open edit would be
                // pointed at the wrong words.
                setEditing(null);
                deleteChecklistStep(task.id, index);
              }}
            />
          ))}
          {adding ? (
            <div className="py-[3px] px-1.5">
              {/* Keyed by how many steps there are, so committing one remounts
                  the field: it stays open and focused for the next step, but
                  empty — the input owns its text, and a component that stayed
                  mounted would offer back the words just added. */}
              <StepInput
                key={items.length}
                label="New checklist item"
                placeholder="What needs doing?"
                onCommit={(text) => addChecklistSteps(task.id, [text])}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setAdding(true)}
              className="justify-start h-[28px] px-1.5 text-neutral-650"
            >
              <PlusIcon size={14} />
              Add an item
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
