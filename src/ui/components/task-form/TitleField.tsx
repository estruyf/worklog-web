import React from 'react';
import { Field, Input } from '../../primitives';

/** The one field the form opens on, which is why it wears the `accent` variant:
 *  a permanent focus ring is how a form says "start typing here". */
export function TitleField({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <Field label="Title" className="mb-[22px]">
      <Input
        autoFocus
        size="lg"
        variant="accent"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Bare ↵ only: ⌘↵ / ctrl+↵ is the form-wide shortcut, and handling it
          // here too saved twice — two tasks from one keypress.
          if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
            onSubmit();
          }
        }}
        placeholder="Add a title for this task"
        className="w-full"
      />
    </Field>
  );
}
