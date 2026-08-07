import React from 'react';
import { NORMAL_PRIORITY_ID, PRIORITIES } from '../../../model/priority';
import { Field, Select, SidebarSection } from '../../primitives';

/** How much the task matters, on the fixed scale. Sits with the other things that
 *  classify a task, above the dates: priority is what it *is*, a due date is when
 *  it has to be done, and the two answer different questions.
 *
 *  Defaults to Normal, which writes no `- priority:` line at all — so a form
 *  submitted without touching this leaves the Markdown exactly as it was. */
export function PriorityField({ value, onChange }: { value: string; onChange: (priority: string) => void }) {
  return (
    <SidebarSection>
      <Field label="Priority" hint="optional">
        <Select value={value || NORMAL_PRIORITY_ID} onChange={(e) => onChange(e.target.value)} className="w-full">
          {PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
    </SidebarSection>
  );
}
