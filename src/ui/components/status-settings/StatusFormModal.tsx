import React from 'react';
import type { StatusDef } from '../../../model/types';
import { MAX_STATUS_LABEL, slugifyStatusId } from '../../../model/status';
import { Button, Field, Input, Modal } from '../../primitives';
import { resolveStatusMeta, STATUS_PALETTE } from '../../utils';

export interface StatusFormModalProps {
  /** The status being edited, or undefined when adding one. */
  status?: StatusDef;
  /** Ids already taken — a new status may not collide with one. */
  takenIds: string[];
  onSave: (fields: { label: string; color: string }) => void;
  onClose: () => void;
}

/** Add / edit a task status: its name, its colour, and a preview of the badge
 *  that name and colour produce. Deliberately small — the id, the position and
 *  which status closes a task are all decided elsewhere, so this dialog has
 *  exactly two fields. */
export function StatusFormModal({ status, takenIds, onSave, onClose }: StatusFormModalProps) {
  const [label, setLabel] = React.useState(status?.label ?? '');
  const [color, setColor] = React.useState(status?.color ?? STATUS_PALETTE[0]);

  const trimmed = label.trim();
  // The id is derived from the name only when adding: on an existing status it
  // is frozen, because it is what every task block in the repo refers to.
  const id = status ? status.id : slugifyStatusId(trimmed);
  const collides = !status && !!id && takenIds.includes(id);
  const canSave = !!trimmed && trimmed.length <= MAX_STATUS_LABEL && !!id && !collides;

  const preview = resolveStatusMeta({ id, label: trimmed || 'Status', color }, id, !!status?.terminal);

  const save = () => {
    if (canSave) {
      onSave({ label: trimmed, color });
    }
  };

  return (
    <Modal
      onClose={onClose}
      showClose
      size="sm"
      offset="sm"
      title={status ? 'Edit status' : 'New status'}
      layer="top"
    >
      <Field label="Name" className="mt-[22px] mb-[22px]">
        <Input
          autoFocus
          size="lg"
          variant="accent"
          value={label}
          maxLength={MAX_STATUS_LABEL}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              save();
            }
          }}
          placeholder="Waiting for"
          className="w-full"
        />
      </Field>

      <label className="block font-semibold text-body mb-[10px]">Color</label>
      <div className="flex flex-wrap gap-[10px]">
        {STATUS_PALETTE.map((p) => {
          const active = color.toLowerCase() === p.toLowerCase();
          return (
            <button
              key={p}
              type="button"
              onClick={() => setColor(p)}
              title={p}
              aria-label={`Use ${p}`}
              aria-pressed={active}
              className={'w-7 h-7 rounded-full cursor-pointer border-2 ' + (active ? 'border-brand-800' : 'border-transparent')}
              style={{ background: p }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-[10px] mt-5 px-[11px] py-[9px] rounded-panel bg-neutral-175">
        <span className="text-status font-bold tracking-status whitespace-nowrap" style={{ color: preview.color }}>
          {preview.label}
        </span>
        <span className="text-meta text-neutral-650">is how it reads on a task.</span>
      </div>

      <div className="text-meta text-neutral-625 mt-3">
        {status ? (
          <>
            Status id <code className="text-neutral-675">{status.id}</code> stays the same — it is what the tasks in
            your Markdown refer to, so renaming here re-labels every one of them at once.
          </>
        ) : id ? (
          <>
            Saved in your Markdown as <code className="text-neutral-675">- status: {id}</code>.
          </>
        ) : (
          'The name needs at least one letter or number.'
        )}
        {collides && <span className="block text-danger-675 mt-1">A status with that id already exists.</span>}
      </div>

      <div className="flex justify-end gap-[10px] mt-[26px]">
        <Button variant="neutral" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" onClick={save} disabled={!canSave}>
          {status ? 'Save status' : 'Add status'}
        </Button>
      </div>
    </Modal>
  );
}
