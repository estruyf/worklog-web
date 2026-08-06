import React from 'react';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from 'lucide-react';
import type { StatusDef } from '../../../model/types';
import { Badge, Button, Card, IconButton, SectionLabel } from '../../primitives';
import { useData } from '../../context';
import { StatusFormModal } from './StatusFormModal';

/** One configured status: how it reads on a task, where it sits in the order,
 *  and how many tasks are in it. The closing status is shown with the same
 *  weight as the rest but without the controls that don't apply to it — it can
 *  be renamed and recoloured, never moved or removed, because it is the one that
 *  archives a task. */
function StatusRow({
  status,
  label,
  color,
  used,
  first,
  last,
  onEdit,
  onMove,
  onRemove,
}: {
  status: StatusDef;
  label: string;
  color: string;
  used: number;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-[10px] px-[18px] py-[13px]">
      {status.terminal ? (
        <span className="w-[46px] shrink-0" aria-hidden="true" />
      ) : (
        <span className="flex shrink-0">
          <IconButton
            size="xs"
            aria-label={`Move ${status.label} up`}
            title="Move up"
            disabled={first}
            onClick={() => onMove(-1)}
          >
            <ChevronUpIcon size={14} />
          </IconButton>
          <IconButton
            size="xs"
            aria-label={`Move ${status.label} down`}
            title="Move down"
            disabled={last}
            onClick={() => onMove(1)}
          >
            <ChevronDownIcon size={14} />
          </IconButton>
        </span>
      )}
      <span className="min-w-[104px] shrink-0 text-status font-bold tracking-status whitespace-nowrap" style={{ color }}>
        {label}
      </span>
      <span className="flex-1 min-w-0 flex flex-wrap items-center gap-x-[10px] gap-y-[2px]">
        <code className="text-meta text-neutral-650">{status.id}</code>
        {status.terminal && (
          <Badge tone="outline" size="xs" title="Reaching this status completes and archives the task">
            closes the task
          </Badge>
        )}
        <span className="text-meta text-neutral-625">
          {used === 0 ? 'no tasks' : `${used} task${used === 1 ? '' : 's'}`}
        </span>
      </span>
      <span className="flex items-center gap-[8px] shrink-0">
        <Button size="xs" onClick={onEdit}>
          Edit
        </Button>
        {!status.terminal && (
          <Button size="xs" variant="danger" onClick={onRemove}>
            Remove
          </Button>
        )}
      </span>
    </div>
  );
}

/** The task-status editor, as it appears in Settings.
 *
 *  Unlike the settings above it, every action here writes `.worklog/config.json`
 *  straight away rather than collecting into a draft: these are list operations
 *  with their own confirmations, and a Save button that also had to hold a
 *  pending removal would be answering two questions at once. */
export function StatusSettings() {
  const {
    statuses,
    statusMeta,
    statusUsage,
    orphanStatuses,
    createStatus,
    updateStatus,
    moveStatus,
    deleteStatus,
  } = useData();
  // undefined: closed. null: adding. A status: editing that one.
  const [editing, setEditing] = React.useState<StatusDef | null | undefined>(undefined);
  const working = statuses.filter((s) => !s.terminal);
  const takenIds = statuses.map((s) => s.id);

  const onSave = (fields: { label: string; color: string }) => {
    if (editing) {
      updateStatus(editing.id, fields);
    } else {
      createStatus(fields.label, fields.color);
    }
    setEditing(undefined);
  };

  return (
    <>
      <div className="mt-10 mb-4">
        <h2 className="text-[17px] font-bold m-0">Task statuses</h2>
        <p className="text-control text-neutral-675 mt-1 mb-0">
          The states a task moves through, in the order the picker offers them. Changes here save right away.
        </p>
      </div>

      <Card className="divide-y divide-neutral-250">
        {statuses.map((s) => {
          const meta = statusMeta(s.id, !!s.terminal);
          const index = working.findIndex((w) => w.id === s.id);
          return (
            <StatusRow
              key={s.id}
              status={s}
              label={meta.label}
              color={meta.color}
              used={statusUsage(s.id)}
              first={index === 0}
              last={index === working.length - 1}
              onEdit={() => setEditing(s)}
              onMove={(delta) => moveStatus(s.id, delta)}
              onRemove={() => deleteStatus(s)}
            />
          );
        })}
        <div className="px-[18px] py-[13px]">
          <Button size="md" onClick={() => setEditing(null)} className="flex items-center gap-[6px]">
            <PlusIcon size={13} strokeWidth={2.2} />
            Add status
          </Button>
        </div>
      </Card>

      {/* Removing a status leaves the tasks in it alone on purpose — the id lives
          in the user's Markdown. This is where those tasks stay visible, so a
          removed status is something you can finish cleaning up rather than a
          label that turns up on a row months later with no explanation. */}
      {orphanStatuses.length > 0 && (
        <div className="mt-6">
          <SectionLabel className="mb-[10px]">Still in use</SectionLabel>
          <Card tone="muted">
            <p className="text-control text-neutral-675 m-0 mb-3">
              These aren’t in the list above, but tasks still carry them and still show them. Put one back to pick it
              again, or open the tasks and move them on — nothing here changes a task by itself.
            </p>
            <div className="divide-y divide-neutral-250 border-t border-neutral-250">
              {orphanStatuses.map((o) => (
                <div key={o.id} className="flex items-center gap-[10px] py-[10px]">
                  <span className="text-status font-bold tracking-status text-neutral-675 whitespace-nowrap min-w-[104px]">
                    {o.id.toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0 text-meta text-neutral-625">
                    {o.count} task{o.count === 1 ? '' : 's'}
                  </span>
                  <Button size="xs" onClick={() => createStatus(o.label, undefined, o.id)}>
                    Add back
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {editing !== undefined && (
        <StatusFormModal
          status={editing ?? undefined}
          takenIds={takenIds}
          onSave={onSave}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
