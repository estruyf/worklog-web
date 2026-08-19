import React, { useState } from 'react';
import { DownloadIcon, PaperclipIcon, Trash2Icon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { Card, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';
import { useAttachmentUpload } from './useAttachmentUpload';

/** The badge's fill by file kind, as whole class strings — Tailwind only emits
 *  what its source scan can read, so these can never be assembled from parts. */
function extTone(ext: string): string {
  if (ext === 'pdf') {
    return 'bg-danger-100 text-danger-700';
  }
  if (['doc', 'docx', 'rtf', 'odt', 'txt', 'md'].includes(ext)) {
    return 'bg-info/10 text-info';
  }
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) {
    return 'bg-success-100 text-success-625';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) {
    return 'bg-brand-200 text-brand-600';
  }
  return 'bg-neutral-250 text-neutral-675';
}

/** The extension as the badge shows it. Cut to four so a `.numbers` keeps the
 *  square square; a file without one still gets a badge rather than a gap. */
function extOf(name: string): { ext: string; label: string } {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return { ext, label: ext ? ext.slice(0, 4).toUpperCase() : 'FILE' };
}

/** The task's attachments: one card per `- attachment:` record — a file-type
 *  badge, the name, and the two things you do with it — followed by the Attach
 *  button that adds another.
 *
 *  That button is the drop target as well as the picker: a full-width dashed
 *  panel spent a section's worth of height on an action taken once, so the zone
 *  shrank to the size of the control and the files got the room instead.
 *
 *  Only rendered once there is one. Attaching the *first* file is an offer rather
 *  than a section — it sits in `TaskContentActions` with the other blocks the task
 *  hasn't got. */
export function AttachmentsSection({ task }: { task: Task }) {
  const { deleteAttachment, downloadAttachment, features } = useData();
  const { confirm } = useUi();
  const [dragOver, setDragOver] = useState(false);
  const { upload, uploading, openFilePicker, fileInput } = useAttachmentUpload(task.id);
  const attachments = task.attachments ?? [];

  const onDelete = async (ref: string) => {
    const name = ref.split('/').pop() ?? ref;
    const ok = await confirm.ask({
      title: `Delete “${name}”?`,
      message: 'The file is removed from the repository along with the record and cannot be recovered.',
      confirmLabel: 'Delete attachment',
      tone: 'danger',
    });
    if (ok) {
      deleteAttachment(task.id, ref);
    }
  };

  // Switched off in Settings the whole block goes, including on a task that has
  // files: the records stay in the Markdown and come back with the switch.
  if (!features.attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <SectionLabel className="mb-[10px]">Attachments · {attachments.length}</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        {attachments.map((ref) => {
          const name = ref.split('/').pop() ?? ref;
          const { ext, label } = extOf(name);
          return (
            <Card
              key={ref}
              radius="panel"
              padding="none"
              className="group flex items-center gap-2.5 min-w-0 max-w-full sm:max-w-[340px] p-[7px] pr-2"
            >
              <span
                aria-hidden="true"
                className={
                  'shrink-0 w-8 h-8 rounded-control flex items-center justify-center text-[9.5px] font-bold tracking-[0.02em] ' +
                  extTone(ext)
                }
              >
                {label}
              </span>
              <button
                type="button"
                onClick={() => downloadAttachment(ref)}
                title={`Download ${name}`}
                className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer text-control-lg font-semibold text-neutral-825 truncate hover:text-info"
              >
                {name}
              </button>
              <button
                type="button"
                onClick={() => downloadAttachment(ref)}
                aria-label={`Download ${name}`}
                title={`Download ${name}`}
                className="shrink-0 w-7 h-7 rounded-control flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-neutral-625 hover:bg-neutral-225 hover:text-neutral-825"
              >
                <DownloadIcon size={15} aria-hidden="true" />
              </button>
              {/* Hover-revealed only where there is a hover; on a phone it stays
                  visible, the way the note actions do. */}
              <button
                type="button"
                onClick={() => onDelete(ref)}
                aria-label={`Delete ${name}`}
                title={`Delete ${name}`}
                className="shrink-0 w-7 h-7 rounded-control flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-neutral-625 hover:bg-danger-75 hover:text-danger-700 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
              >
                <Trash2Icon size={14} aria-hidden="true" />
              </button>
            </Card>
          );
        })}
        {/* Dashed because it takes a drop as well as a click — the border is the
            only thing saying so once the zone is button-sized. */}
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload(e.dataTransfer.files);
          }}
          disabled={uploading}
          title="Attach a file — or drop one here"
          className={
            'shrink-0 h-12 flex items-center gap-[7px] px-4 rounded-panel border-[1.5px] border-dashed cursor-pointer text-control-lg font-medium transition-colors disabled:cursor-default ' +
            (dragOver
              ? 'border-info bg-info/5 text-info'
              : 'border-neutral-500 bg-neutral-150 text-neutral-675 hover:border-neutral-600 hover:bg-neutral-200 hover:text-neutral-750')
          }
        >
          {/* The children would fire `dragleave` as the pointer crosses them, which
              reads as leaving the zone and drops the highlight mid-drag. */}
          <PaperclipIcon size={15} className="shrink-0 pointer-events-none" aria-hidden="true" />
          <span className="pointer-events-none">{uploading ? 'Attaching…' : 'Attach'}</span>
        </button>
      </div>
      {fileInput}
    </div>
  );
}
