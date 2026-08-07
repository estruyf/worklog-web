import React from 'react';
import { NORMAL_PRIORITY_ID, PRIORITIES, priorityBucket, priorityDef } from '../../model/priority';
import { Menu } from '../primitives';
import { PriorityChipTrigger, PriorityIcon } from './PriorityChip';

export interface PriorityPickerProps {
  /** A raw `- priority:` value; anything off the scale reads as normal. */
  value: string | undefined;
  onSelect: (priority: string) => void;
  /** Layout only — the trigger is the chip, and it owns its own look. */
  className?: string;
}

/** The priority on a task, as the thing you change it with — the same chip the
 *  task lists show, made pressable, so the value and the control are one thing
 *  in both places you meet it.
 *
 *  A menu rather than the `Select` this replaced: the scale is four fixed
 *  options, three of which have a colour and a chevron that mean something, and a
 *  native select can show neither. It also puts the detail panel's priority and
 *  status on the same idiom — click the value, pick another.
 *
 *  Prop-driven, like `StatusPicker`: it has to work from a memoized row as well
 *  as from the two rails, and reading context would re-render the row on every
 *  edit anywhere. */
export function PriorityPicker({ value, onSelect, className }: PriorityPickerProps) {
  const options = React.useMemo(
    () =>
      PRIORITIES.map((p) => ({
        id: p.id,
        label: p.label,
        icon: <PriorityIcon priority={p.id} />,
        hint: p.id === NORMAL_PRIORITY_ID ? 'No priority set' : undefined,
      })),
    [],
  );
  const current = priorityBucket(value);
  const name = priorityDef(current)?.label ?? current;
  return (
    <Menu
      options={options}
      value={current}
      onSelect={onSelect}
      label={`Priority: ${name}. Change it`}
      title="Change priority"
      className={'group ' + (className ?? '')}
    >
      <PriorityChipTrigger priority={value} />
    </Menu>
  );
}
