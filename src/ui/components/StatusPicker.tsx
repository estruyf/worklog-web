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
  /** How loud the trigger is. `label` is the uppercase coloured word the detail
   *  panel and the subtask list use, where the status is the thing being read.
   *  `dot` is a coloured dot plus the status in neutral type, for the task lists:
   *  in a row the title has to be the strongest element, and a column of bold
   *  coloured words out-shouts every task name on the page. Colour still carries
   *  the status, but on the dot rather than on the text — which is also why the
   *  word stays: a dot on its own would be the only thing saying it. */
  variant?: 'label' | 'dot';
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
export function StatusPicker({
  statusId,
  label,
  name,
  color,
  done,
  choices,
  onSelect,
  variant = 'label',
  className,
}: StatusPickerProps) {
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
  const shared = {
    options,
    value: statusId,
    onSelect,
    label: `Status: ${name}. Change it`,
    title: 'Change status',
  };
  if (variant === 'dot') {
    return (
      <Menu {...shared} className={'flex items-center gap-[6px] text-eyebrow font-medium text-neutral-650 ' + (className ?? '')}>
        <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
        <span className="min-w-0 truncate">{name}</span>
      </Menu>
    );
  }
  return (
    <Menu {...shared} className={'text-status font-bold tracking-status whitespace-nowrap ' + (className ?? '')} style={{ color }}>
      {label}
    </Menu>
  );
}
