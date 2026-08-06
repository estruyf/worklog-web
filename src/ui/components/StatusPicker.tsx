import React from 'react';
import type { StatusChoice } from '../model';
import { Menu } from '../primitives';

export interface StatusPickerProps {
  /** The status the task is in — ticked in the list. */
  statusId: string;
  /** How that status reads and looks right now, already resolved: `label` is the
   *  uppercase form on the trigger, `name` the one a screen reader is given. */
  label: string;
  name: string;
  color: string;
  /** Whether the task is closed, which is what the two hints below turn on. */
  done: boolean;
  choices: StatusChoice[];
  onSelect: (statusId: string) => void;
  /** Layout only — the trigger keeps the status column's own type and colour. */
  className?: string;
}

/** The status on a task, as the thing you change it with. Picking the closing
 *  status completes and archives the task; picking a working one from a closed
 *  task brings it back — both are `setStatus`, which is why this is one control
 *  rather than a label plus a Done button.
 *
 *  Prop-driven rather than context-reading: it renders inside the memoized
 *  `WorklogTaskRow`, and a context subscription there would re-render every row
 *  on every edit. */
export function StatusPicker({ statusId, label, name, color, done, choices, onSelect, className }: StatusPickerProps) {
  const options = React.useMemo(
    () =>
      choices.map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
        hint: c.terminal ? (done ? undefined : 'Completes and archives it') : done ? 'Reopens it from the archive' : undefined,
      })),
    [choices, done],
  );
  return (
    <Menu
      options={options}
      value={statusId}
      onSelect={onSelect}
      label={`Status: ${name}. Change it`}
      title="Change status"
      className={'text-status font-bold tracking-status whitespace-nowrap ' + (className ?? '')}
      style={{ color }}
    >
      {label}
    </Menu>
  );
}
