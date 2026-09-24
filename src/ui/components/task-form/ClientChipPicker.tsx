import React from 'react';
import { SidebarSection } from '../../primitives';
import { ClientPicker } from '../ClientPicker';

/** The task form's client rail block: `ClientPicker` under the rail's own
 *  heading. A task always has a client — the general to-do bucket stands in when
 *  it has none — so no "no client" chip is offered here. */
export function ClientChipPicker({ value, onChange }: { value: string; onChange: (clientId: string) => void }) {
  return (
    <SidebarSection title="Client" divider={false}>
      <ClientPicker value={value} onChange={onChange} />
    </SidebarSection>
  );
}
