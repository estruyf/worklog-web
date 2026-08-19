import React, { useRef, useState } from 'react';
import { useData } from '../../context';

/** The file picker and the upload both attachment surfaces need: the "Attach"
 *  action on a task that has none, and the drop zone under a list that does.
 *
 *  It hands back the hidden `<input>` to render rather than mounting one itself —
 *  a picker with no input opens nothing, and the two call sites are never on
 *  screen at the same time, so one shared input would belong to neither. */
export function useAttachmentUpload(taskId: string) {
  const { addAttachment } = useData();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    setUploading(true);
    // Sequential: each write reads and rewrites the same client file.
    for (const file of Array.from(files)) {
      await addAttachment(taskId, file);
    }
    setUploading(false);
  };

  const fileInput = (
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
  );

  return { upload, uploading, openFilePicker: () => fileInputRef.current?.click(), fileInput };
}
