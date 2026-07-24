// Wires paste / drag-drop / file-pick image insertion onto a Markdown textarea.
// Uploads go through useImageUpload (host writes the file, returns a ref) and the
// resulting `![](assets/…)` snippet is spliced in at the caret. Shared by the
// new-task modal and the task detail panel so both edit descriptions the same way.

import React, { useCallback, useRef, useState } from 'react';
import { useImageUpload } from './useImageUpload';

type Setter = React.Dispatch<React.SetStateAction<string>>;

export interface MarkdownImages {
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  openFilePicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  error: string;
}

function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return list ? Array.from(list).filter((f) => f.type.startsWith('image/')) : [];
}

/** `value`/`setValue` own the Markdown text; the hook only inserts image refs into it. */
export function useMarkdownImages(value: string, setValue: Setter): MarkdownImages {
  const upload = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const insertFiles = useCallback(
    async (files: File[], caret: number) => {
      if (!files.length) {
        return;
      }
      setError('');
      setUploading(true);
      let at = caret;
      for (const file of files) {
        try {
          const ref = await upload(file);
          // Splice the ref in at the caret, on its own line so it renders as a block.
          setValue((prev) => {
            const before = prev.slice(0, at);
            const after = prev.slice(at);
            const lead = before && !before.endsWith('\n') ? '\n' : '';
            const snippet = `${lead}![](${ref})\n`;
            at += snippet.length; // advance so a second image lands after this one
            return before + snippet + after;
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
      setUploading(false);
    },
    [upload, setValue],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = imageFiles(e.clipboardData?.files);
      if (files.length) {
        e.preventDefault();
        void insertFiles(files, e.currentTarget.selectionStart ?? e.currentTarget.value.length);
      }
    },
    [insertFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      const files = imageFiles(e.dataTransfer?.files);
      if (files.length) {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const caret = typeof target.selectionStart === 'number' ? target.selectionStart : value.length;
        void insertFiles(files, caret);
      }
    },
    [insertFiles, value.length],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Must cancel dragover for the textarea to fire a drop event for files.
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }
  }, []);

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = imageFiles(e.target.files);
      void insertFiles(files, value.length);
      e.target.value = '';
    },
    [insertFiles, value.length],
  );

  return { onPaste, onDrop, onDragOver, openFilePicker, fileInputRef, onFileChange, uploading, error };
}
