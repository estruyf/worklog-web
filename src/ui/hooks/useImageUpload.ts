// Reads a picked/pasted/dropped image as base64 and hands it to the store, which
// writes it under `assets/` and returns the markdown ref to insert.

import { useCallback } from 'react';
import { worklogStore } from '../../data/worklogStore';

/** File types we let the user attach; others are rejected before upload. */
const ALLOWED = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i;

/** Returns an `upload(file)` that resolves to a markdown image ref, e.g. `assets/img-….png`. */
export function useImageUpload(): (file: File) => Promise<string> {
  return useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      if (!ALLOWED.test(file.type)) {
        reject(new Error('Only image files can be added.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the image.'));
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        worklogStore.saveImage(base64, file.type).then(resolve, reject);
      };
      reader.readAsDataURL(file);
    });
  }, []);
}
