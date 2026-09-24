import React, { useRef, useState } from 'react';
import { CheckIcon, EllipsisIcon, SquareArrowOutUpRightIcon } from 'lucide-react';
import type { Meeting, MeetingAction } from '../../../model/types';
import { Input, LinkButton, Menu, SectionLabel } from '../../primitives';
import type { MenuOption } from '../../primitives';
import { useData } from '../../context';
import { isActionDone } from '../../utils';

/** One line editor that commits on ↵ or blur and abandons on Esc — an action item
 *  is typed in the middle of a conversation, and a Save button per row would be
 *  most of the section. */
function LineInput({
  value = '',
  placeholder,
  label,
  onCommit,
  onCancel,
  autoFocus = false,
}: {
  value?: string;
  placeholder?: string;
  label: string;
  onCommit: (text: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value);
  // An edit ends once. Leaving by ↵ or Esc unmounts the field, and the blur that
  // follows would otherwise commit a second time — or commit what Esc abandoned.
  const ended = useRef(false);
  const commit = () => {
    if (ended.current) {
      return;
    }
    ended.current = !!onCancel;
    const words = text.replace(/\s+/g, ' ').trim();
    if (words) {
      onCommit(words);
    } else {
      onCancel?.();
    }
  };
  return (
    <Input
      size="sm"
      value={text}
      placeholder={placeholder}
      aria-label={label}
      autoFocus={autoFocus}
      className="w-full"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          // The add field stays open for the next item; an edit closes itself.
          if (!onCancel) {
            setText('');
          }
        } else if (e.key === 'Escape') {
          // Kept inside the field: Escape out here would close the meeting.
          e.stopPropagation();
          ended.current = !!onCancel;
          setText(value);
          onCancel?.();
        }
      }}
      onBlur={() => (onCancel ? commit() : undefined)}
    />
  );
}

function ActionRow({
  meeting,
  action,
  index,
  onChange,
}: {
  meeting: Meeting;
  action: MeetingAction;
  index: number;
  onChange: (actions: MeetingAction[]) => void;
}) {
  const { taskById, makeTaskFromAction, openDetail, statusMeta } = useData();
  const [editing, setEditing] = useState(false);
  const task = action.taskId ? taskById.get(action.taskId) : undefined;
  const done = isActionDone(action, taskById);

  const replace = (next: MeetingAction | null) =>
    onChange(meeting.actions.flatMap((a, i) => (i !== index ? [a] : next ? [next] : [])));

  if (editing) {
    return (
      <div className="py-[3px] px-1">
        <LineInput
          value={action.text}
          label={`Edit “${action.text}”`}
          autoFocus
          onCommit={(text) => {
            setEditing(false);
            replace({ ...action, text });
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const options: MenuOption[] = [
    task ? { id: 'open', label: 'Open task' } : { id: 'task', label: 'Make it a task' },
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
  ];
  const onSelect = (id: string) => {
    if (id === 'task') {
      void makeTaskFromAction(meeting, index);
    } else if (id === 'open' && task) {
      openDetail(task);
    } else if (id === 'edit') {
      setEditing(true);
    } else if (id === 'delete') {
      replace(null);
    }
  };
  const meta = task ? statusMeta(task.status, !!task.completed) : undefined;

  return (
    <div className="group/item flex items-center gap-[9px] min-h-[30px] px-2.5 rounded-control hover:bg-neutral-175">
      {/* A linked item's box is its task's state, so it isn't a control here: the
          task is where that work is closed now. */}
      <button
        type="button"
        disabled={!!task}
        onClick={() => replace({ ...action, done: !action.done })}
        aria-pressed={done}
        aria-label={task ? `${action.text} — tracked as a task` : done ? `Untick ${action.text}` : `Tick off ${action.text}`}
        title={task ? 'Tracked as a task — close it there' : done ? 'Put it back' : 'Tick it off'}
        className={
          'w-[16px] h-[16px] shrink-0 rounded-full p-0 flex items-center justify-center ' +
          (task ? 'cursor-default ' : 'cursor-pointer ') +
          (done
            ? 'bg-success-500 border-[1.5px] border-success-500 text-white'
            : 'bg-white border-[1.5px] border-neutral-575 text-neutral-500 enabled:hover:border-success-500 enabled:hover:text-success-500')
        }
      >
        <CheckIcon size={10} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit"
        className={
          'text-body text-left flex-1 min-w-0 bg-transparent border-none p-0 cursor-text ' +
          (done ? 'line-through decoration-neutral-550 text-neutral-700' : 'text-neutral-825')
        }
      >
        {action.text}
      </button>
      {task && meta && (
        <LinkButton
          size="sm"
          tone="neutral"
          onClick={() => openDetail(task)}
          title={`Open “${task.title}”`}
          className="shrink-0 inline-flex items-center gap-[5px] no-underline hover:no-underline"
        >
          <span className="text-status font-bold tracking-status" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <SquareArrowOutUpRightIcon size={12} aria-hidden="true" />
        </LinkButton>
      )}
      <Menu
        kind="action"
        align="end"
        label={`Actions for “${action.text}”`}
        options={options}
        onSelect={onSelect}
        className="w-[22px] h-[22px] shrink-0 flex items-center justify-center rounded-control text-neutral-625 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100 sm:focus-visible:opacity-100 hover:text-neutral-825 hover:bg-neutral-250"
      >
        <EllipsisIcon size={14} aria-hidden="true" />
      </Menu>
    </div>
  );
}

/** The meeting's `### Action items`: what came out of it, ticked here or turned
 *  into a task on the meeting's client and tracked from then on as one. */
export function ActionItems({ meeting, onChange }: { meeting: Meeting; onChange: (actions: MeetingAction[]) => void }) {
  return (
    <section className="mt-8">
      <SectionLabel className="mb-[10px]">Action items</SectionLabel>
      <div className="flex flex-col gap-[2px]">
        {meeting.actions.map((a, i) => (
          // Index keys: an item has no id in the Markdown, and its position is
          // exactly what every edit here addresses it by.
          <ActionRow key={`${i}:${a.text}`} meeting={meeting} action={a} index={i} onChange={onChange} />
        ))}
        <div className="pt-[6px] px-1">
          <LineInput
            placeholder="Add an action item and press ↵"
            label="Add an action item"
            onCommit={(text) => onChange([...meeting.actions, { text, done: false }])}
          />
        </div>
      </div>
    </section>
  );
}
