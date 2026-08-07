import React from 'react';
import { Button } from '../../primitives';
import { closeTaskForm } from '../../router';

export interface FormActionBarProps {
  /** The task being edited; null when adding, which is what Delete keys off. */
  editingId: string | null;
  canSave: boolean;
  onSave: () => void;
  onDelete: (id: string) => void;
}

/** The form's footer, stuck to the bottom of the viewport so a long form can
 *  never strand its own buttons below the fold. */
export function FormActionBar({ editingId, canSave, onSave, onDelete }: FormActionBarProps) {
  return (
    <div className="sticky bottom-0 bg-white border-t border-neutral-375">
      <div className="max-w-[920px] xl:max-w-[1280px] mx-auto w-full flex items-center justify-between px-5 py-3 md:px-8">
        <div>
          {editingId && (
            <Button variant="danger" size="lg" onClick={() => onDelete(editingId)}>
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-[10px]">
          <Button variant="neutral" size="lg" onClick={closeTaskForm}>
            Close
          </Button>
          {/* `submitTask` already returns early without a title or a client, so
              disabling here only surfaces that rule to the keyboard and to
              assistive tech — it doesn't change what a click does. */}
          <Button variant="primary" size="lg" onClick={onSave} disabled={!canSave}>
            {editingId ? 'Save task' : 'Add task'}
          </Button>
        </div>
      </div>
    </div>
  );
}
