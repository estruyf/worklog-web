import React, { useRef, useState } from 'react';
import { PaperclipIcon } from 'lucide-react';
import type { Task } from '../../../model/types';
import { LinkButton, SectionLabel } from '../../primitives';
import { useData, useUi } from '../../context';

/** The task's attachments: one row per `- attachment:` record, where the name is
 *  the download, over the drop zone that adds another.
 *
 *  The zone sits here rather than in the rail's Actions list, for the reason the
 *  subtask list keeps its own add button: the list a file lands in is on screen
 *  when you drop it. That is also why the section renders with nothing attached —
 *  it is the entry point, so it cannot be conditional on there already being one. */
export function AttachmentsSection({ task }: { task: Task }) {
  const { addAttachment, deleteAttachment, downloadAttachment } = useData();
  const { confirm } = useUi();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = task.attachments ?? [];

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
    <div className="mt-9 mb-7">
      <SectionLabel className="mb-[10px]">
        Attachments{attachments.length > 0 && ` · ${attachments.length}`}
      </SectionLabel>
      {attachments.length > 0 && (
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
      )}
      {/* A bordered target rather than a line of text: a drop zone that doesn't
          look like one only gets clicked. */}
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
