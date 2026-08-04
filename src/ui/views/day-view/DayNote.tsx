// The day's freeform Markdown, inside the day card and above its footer. The
// half of a day that isn't billed and isn't a task — what was said, what was
// decided — which would otherwise end up somewhere outside the repo.
//
// It renders nothing at all until there is something to render: an unwritten day
// is reached through the footer's "Add note", not through an empty frame sitting
// on every day of the year. Editing borrows `DescriptionEditor`, so the
// write/preview toggle and image paste/drop behave exactly as they do on a task.

import React from 'react';
import { DescriptionEditor, MARKDOWN_CHEATSHEET, MarkdownView, type DescriptionMode } from '../../components';
import { Button, Card, SectionLabel } from '../../primitives';

export interface DayNoteProps {
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
  mode: DescriptionMode;
  onModeChange: (mode: DescriptionMode) => void;
  dirty: boolean;
  onSave: () => void;
  /** Puts the draft back and closes the editor — the only way out that discards. */
  onCancel: () => void;
}

const PLACEHOLDER = `Anything worth remembering about this day…\n\n${MARKDOWN_CHEATSHEET}`;

export function DayNote({ value, onChange, mode, onModeChange, dirty, onSave, onCancel }: DayNoteProps) {
  if (mode === 'preview') {
    // Read-only, and deliberately without the editor's header: in the card the
    // note is content, and a mode toggle over two lines of prose is furniture.
    return value.trim() ? (
      <div className="mt-4">
        <SectionLabel className="mb-[10px]">Notes</SectionLabel>
        <Card tone="muted" padding="md" radius="panel">
          <MarkdownView text={value} />
        </Card>
      </div>
    ) : null;
  }

  return (
    <div className="mt-4">
      <DescriptionEditor
        value={value}
        onChange={onChange}
        mode={mode}
        onModeChange={onModeChange}
        title="Notes"
        placeholder={PLACEHOLDER}
        action={
          <>
            <Button variant="neutral" size="xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" size="xs" onClick={onSave} disabled={!dirty} className="font-semibold">
              Save
            </Button>
          </>
        }
      />
    </div>
  );
}
