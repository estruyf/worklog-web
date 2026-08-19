import React, { useRef, useState } from 'react';
import { ChevronRightIcon, PaperclipIcon, PlusIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { LinkButton, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';

/** The task's attachments: one row per `- attachment:` record, where the name is
 *  the download, plus the drop zone that adds another. Rendered only when the
 *  task has any — attaching the first file goes through the Actions rail. */
export function AttachmentsSection({ task }: { task: Task }) {
  const { addAttachment, deleteAttachment, downloadAttachment } = useData();
  const { confirm } = useUi();
  const [open, setOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = task.attachments ?? [];
  if (attachments.length === 0) {
    return null;
  }

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    setUploading(true);
    // Sequential: each write reads and rewrites the same client file.
    for (const file of Array.from(files)) {
      await addAttachment(task.id, file);
    }
    setUploading(false);
  };

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

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer mb-[6px]"
      >
        <ChevronRightIcon size={14} className={'text-neutral-650 transition-transform ' + (open ? 'rotate-90' : '')} />
        <SectionLabel>Attachments · {attachments.length}</SectionLabel>
      </button>
      {open && (
        <div className="flex flex-col gap-1 min-w-0">
          {attachments.map((ref) => {
            const name = ref.split('/').pop() ?? ref;
            return (
              <div key={ref} className="group flex items-center gap-[10px] min-w-0">
                <button
                  type="button"
                  onClick={() => downloadAttachment(ref)}
                  title={`Download ${name}`}
                  className="flex items-center gap-[7px] min-w-0 bg-transparent border-none p-0 cursor-pointer text-control-lg text-info hover:underline"
                >
                  <PaperclipIcon size={14} className="shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
                {/* Hover-revealed only where there is a hover; on a phone it
                    stays visible, the way the note actions do. */}
                <LinkButton
                  size="inherit"
                  tone="muted"
                  onClick={() => onDelete(ref)}
                  title={`Delete ${name}`}
                  className="text-count lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100"
                >
                  Delete
                </LinkButton>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
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
            className={
              'flex items-center gap-[7px] mt-1 bg-transparent border-none p-0 cursor-pointer text-control-lg ' +
              (dragOver ? 'text-info' : 'text-neutral-650 hover:text-neutral-750')
            }
          >
            <PlusIcon size={14} className="shrink-0" />
            {uploading ? 'Uploading…' : 'Click or drag & drop to add a file'}
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}
