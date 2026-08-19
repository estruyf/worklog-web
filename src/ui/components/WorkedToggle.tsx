import React from 'react';
import { BriefcaseIcon } from 'lucide-react';

/** The briefcase toggle that logs a task as worked on the selected day. Three
 *  lists render it — the day view's rows, a task's subtasks and the task
 *  header — so it lives here rather than being re-styled in each: the fill
 *  states are the only thing that says "this is already logged", and they have
 *  to mean the same thing everywhere.
 *
 *  It takes its wording rather than deriving it, because the row lists build
 *  their labels in the view model (`workedLabels`) and this stays presentational.
 *  Both variants carry the sentence in `title`: the glyph alone doesn't say what
 *  gets written, or to which day. */
export interface WorkedToggleProps {
  worked: boolean;
  onToggle: () => void;
  /** The full explanation, shown on hover. */
  title: string;
  /** Short action text — visible on `labeled`, the accessible name on `icon`. */
  label: string;
  /** Overrides the accessible name, for lists where the label alone ("Log work
   *  today") wouldn't say which task it belongs to. */
  ariaLabel?: string;
  variant?: 'icon' | 'labeled';
  /** Matches the diameter of the done circle it sits next to: `md` in the day
   *  view's rows, `sm` in a task's subtask list. */
  size?: 'sm' | 'md';
}

// Written out rather than assembled: Tailwind only emits classes it finds in the
// source, so `w-[${n}px]` would compile and ship without CSS.
const SIZES: Record<'sm' | 'md', string> = {
  sm: 'w-[16px] h-[16px]',
  md: 'w-[17px] h-[17px]',
};

const ICON_TONES = {
  on: 'border border-brand-575 text-brand-575 bg-brand-225 hover:bg-brand-300',
  off: 'border-[1.5px] border-brand-525 bg-white hover:border-brand-575 text-brand-525 hover:text-brand-575',
};

const LABELED_TONES = {
  on: 'border-brand-500 bg-brand-225 text-brand-650 hover:bg-brand-275',
  off: 'border-brand-400 bg-brand-100 text-brand-625 hover:bg-brand-200',
};

export function WorkedToggle({ worked, onToggle, title, label, ariaLabel, variant = 'icon', size = 'md' }: WorkedToggleProps) {
  if (variant === 'labeled') {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={title}
        aria-pressed={worked}
        className={
          'flex items-center gap-[6px] px-[14px] py-[7px] border rounded-control font-semibold text-control cursor-pointer ' +
          (worked ? LABELED_TONES.on : LABELED_TONES.off)
        }
      >
        <BriefcaseIcon className="w-[13px] h-[13px]" />
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-pressed={worked}
      aria-label={ariaLabel ?? label}
      // The halo mirrors the done circle's in `WorklogTaskRow`: ±8px vertically,
      // ±5px sideways — half the 11px gap between them, so the two targets grow
      // without overlapping each other.
      className={
        'relative before:absolute before:-inset-y-2 before:-inset-x-[5px] shrink-0 rounded-full cursor-pointer p-0 flex items-center justify-center ' +
        SIZES[size] +
        ' ' +
        (worked ? ICON_TONES.on : ICON_TONES.off)
      }
    >
      <BriefcaseIcon className="w-[10px] h-[10px]" aria-hidden="true" />
    </button>
  );
}
