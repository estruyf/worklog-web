import React from 'react';
import { Chip, DateInput, Field, LinkButton } from '../../primitives';
import { useData } from '../../context';
import { today } from '../../../util/date';
import { SidebarSection } from './SidebarSection';

/** The task's deadline, with a one-click Today.
 *
 *  Only for a task that doesn't repeat: with a repeat rule this date isn't a
 *  deadline, it's where the series starts and rolls forward on its own from
 *  there, and the repeat block owns it next to the rule it belongs to. */
export function DueField({ value, onChange }: { value: string; onChange: (due: string) => void }) {
  const { snap } = useData();
  // The snapshot's day rolls over with the app; fall back to the clock before the
  // first snapshot lands so the shortcut is never a stale or empty date.
  const todayKey = snap?.today || today();
  return (
    <SidebarSection>
      <Field
        label="Due"
        hint="optional"
        action={
          value && (
            <LinkButton size="xs" onClick={() => onChange('')}>
              Clear
            </LinkButton>
          )
        }
      >
        <DateInput value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
        {/* Today is by far the most common due date, and picking it from the
            native date input takes more clicks than it's worth. */}
        <Chip variant="filter" selected={value === todayKey} onClick={() => onChange(value === todayKey ? '' : todayKey)} className="mt-2">
          Today
        </Chip>
      </Field>
    </SidebarSection>
  );
}
