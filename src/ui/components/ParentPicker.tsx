import React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import type { Task } from '../../model/types';
import { Menu } from '../primitives';

export interface ParentPickerProps {
  /** The current parent's id; '' for a top-level task. */
  value: string;
  /** What the task may hang off — `parentCandidates` decides, not this. */
  options: Task[];
  onSelect: (parentId: string) => void;
  className?: string;
}

/** The label for the "hangs off nothing" choice, which is a real choice rather
 *  than an empty one — it is how a subtask is promoted back to top level. */
const NONE_LABEL = 'No parent';

/** The task a task hangs off, as the thing you change it with.
 *
 *  A filtered menu rather than the `<select>` this replaced: the options are
 *  every open top-level task of one client, which for a client you have worked
 *  with for a while is a list you scroll rather than read. Typing three letters of
 *  the title beats hunting, and a native select can't be typed into past its
 *  first-letter jump.
 *
 *  Prop-driven, so it serves the task form (where nothing is written until save)
 *  and the detail rail (where picking writes immediately) without knowing which
 *  it is in. */
export function ParentPicker({ value, options, onSelect, className }: ParentPickerProps) {
  const menuOptions = React.useMemo(
    () => [{ id: '', label: NONE_LABEL }, ...options.map((t) => ({ id: t.id, label: t.title }))],
    [options],
  );
  const current = options.find((t) => t.id === value);
  const name = current?.title ?? NONE_LABEL;
  return (
    <Menu
      options={menuOptions}
      value={value}
      onSelect={onSelect}
      label={`Parent: ${name}. Change it`}
      title="Change parent"
      // Long enough a list to be worth filtering is exactly when it is also long
      // enough that the panel needs to reach past the 320px rail it hangs in.
      searchable={options.length > 7}
      searchPlaceholder="Find a task…"
      emptyText="No matching task"
      className={'group w-full ' + (className ?? '')}
    >
      <span
        className={
          'flex items-center gap-[6px] w-full text-control group-hover:text-neutral-900 ' +
          (current ? 'text-neutral-750' : 'text-neutral-650')
        }
      >
        <span className="flex-1 min-w-0 truncate">{name}</span>
        <ChevronDownIcon size={13} strokeWidth={2} className="shrink-0 text-neutral-625" aria-hidden="true" />
      </span>
    </Menu>
  );
}
