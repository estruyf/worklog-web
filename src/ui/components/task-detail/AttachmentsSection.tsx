import React, { useState } from 'react';
import { PaperclipIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { LinkButton, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';
import { useAttachmentUpload } from './useAttachmentUpload';

/** The task's attachments: one row per `- attachment:` record, where the name is
 *  the download, over the drop zone that adds another.
 *
 *  Only rendered once there is one. Attaching the *first* file is an offer rather
 *  than a section — it sits in `TaskContentActions` with the other blocks the task
 *  hasn't got — and the zone here is what a second file lands on. */
export function AttachmentsSection({ task }: { task: Task }) {
  const { deleteAttachment, downloadAttachment } = useData();
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

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <SectionLabel className="mb-[10px]">Attachments · {attachments.length}</SectionLabel>
      <div className="flex flex-col gap-1 min-w-0 mb-2.5">
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
      </div>
      {/* A bordered target rather than a line of text: a drop zone that doesn't
          look like one only gets clicked. */}
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
        className={
          'w-full flex items-center justify-center px-4 py-5 rounded-panel border-[1.5px] border-dashed cursor-pointer text-control transition-colors ' +
          (dragOver
            ? 'border-info bg-info/5 text-info'
            : 'border-neutral-500 bg-neutral-150 text-neutral-675 hover:border-neutral-600 hover:bg-neutral-200 hover:text-neutral-750')
        }
      >
        {/* The children would fire `dragleave` as the pointer crosses them, which
            reads as leaving the zone and drops the highlight mid-drag. */}
        <span className="pointer-events-none flex flex-col items-center gap-1.5">
          <PaperclipIcon size={18} className="shrink-0" />
          <span className="font-medium">{uploading ? 'Uploading…' : 'Drop files here to attach'}</span>
          {!uploading && <span className="text-count">or click to browse</span>}
        </span>
      </button>
      {fileInput}
    </div>
  );
}
