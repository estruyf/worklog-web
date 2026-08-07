import React from 'react';
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpIcon, MinusIcon } from 'lucide-react';
import { NORMAL_PRIORITY_ID, priorityDef } from '../../model/priority';

/** How each priority paints, and what it points at. Static class strings, not
 *  assembled ones: Tailwind emits what its source scan can see written out — and
 *  the text colour is split out from the pill's because the menu draws the mark
 *  on its own, without a pill around it.
 *
 *  Rank is carried by the chevrons as well as the colour — two up for urgent, one
 *  for high, one down for low — so the three don't rely on hue alone. Low is
 *  deliberately the quietest thing on a row: it is there to be skipped.
 *
 *  Normal is in the table but never on a row. A list marks the exceptions, and a
 *  grey "Normal" chip on every ordinary task would drown them; the picker is the
 *  one place normal has to be drawn, because a control that shows nothing when
 *  its value is the default reads as broken. */
const PRIORITY_LOOKS: Record<string, { text: string; pill: string; icon: typeof ChevronUpIcon }> = {
  urgent: { text: 'text-danger-675', pill: 'bg-danger-75 border-danger-200', icon: ChevronsUpIcon },
  high: { text: 'text-brand-650', pill: 'bg-brand-150 border-brand-375', icon: ChevronUpIcon },
  normal: { text: 'text-neutral-700', pill: 'bg-neutral-200 border-neutral-375', icon: MinusIcon },
  low: { text: 'text-neutral-675', pill: 'bg-neutral-250 border-neutral-400', icon: ChevronDownIcon },
};

const PILL = 'shrink-0 inline-flex items-center gap-[3px] text-eyebrow font-semibold px-[7px] py-[2px] rounded-full border ';

/** The chevron on its own, in the priority's colour — for the menu options, where
 *  the row already carries the label and a pill inside it would be noise. */
export function PriorityIcon({ priority }: { priority: string }) {
  const look = PRIORITY_LOOKS[priority];
  if (!look) {
    return null;
  }
  const Icon = look.icon;
  return <Icon size={13} strokeWidth={2.4} className={look.text} />;
}

/** The priority marker as a task list shows it: only the three that mean
 *  something render one, so `normal` and anything off the scale draw nothing. */
export function PriorityChip({ priority }: { priority: { id: string; label: string } }) {
  const look = priority.id === NORMAL_PRIORITY_ID ? undefined : PRIORITY_LOOKS[priority.id];
  if (!look) {
    return null;
  }
  const Icon = look.icon;
  return (
    <span title={`${priority.label} priority`} className={PILL + look.text + ' ' + look.pill}>
      <Icon size={11} strokeWidth={2.4} />
      {priority.label}
    </span>
  );
}

/** The same pill as a menu trigger: draws every priority, normal included, and
 *  darkens on hover so it reads as something you can press. Expects the trigger
 *  it sits in to carry `group`. */
export function PriorityChipTrigger({ priority }: { priority: string | undefined }) {
  const def = priorityDef(priority);
  const look = PRIORITY_LOOKS[def?.id ?? NORMAL_PRIORITY_ID] ?? PRIORITY_LOOKS[NORMAL_PRIORITY_ID];
  const Icon = look.icon;
  return (
    <span className={PILL + look.text + ' ' + look.pill + ' group-hover:brightness-95'}>
      <Icon size={11} strokeWidth={2.4} />
      {def?.label ?? 'Normal'}
    </span>
  );
}
