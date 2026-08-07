import React from 'react';
import { SidebarSection } from '../../primitives';
import { PriorityPicker } from '../PriorityPicker';

/** How much the task matters, on the fixed scale. Sits with the other things that
 *  classify a task, above the dates: priority is what it *is*, a due date is when
 *  it has to be done, and the two answer different questions.
 *
 *  The same picker the detail rail and the task rows use, so a priority is read
 *  and set as the one chip everywhere. `SidebarSection`'s own title rather than a
 *  `Field` label: the control is a button, not an input, so there is no
 *  labelled-control pairing to make — the picker names itself.
 *
 *  Defaults to Normal, which writes no `- priority:` line at all — so a form
 *  submitted without touching this leaves the Markdown exactly as it was. */
export function PriorityField({ value, onChange }: { value: string; onChange: (priority: string) => void }) {
  return (
    <SidebarSection title="Priority" hint="optional">
      <PriorityPicker value={value} onSelect={onChange} />
    </SidebarSection>
  );
}
