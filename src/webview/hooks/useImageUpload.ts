// Uploads an image to the host and resolves with the markdown ref to insert.
// postMessage can't carry binary, so the file is read as base64 and sent with a
// requestId; the host writes it under `assets/` and replies `imageSaved`, which
// we correlate back to the pending promise.

import { useCallback, useEffect, useRef } from 'react';
import { HostMessage } from '../protocol';
import { onHostMessage, post } from '../vscodeApi';

/** File types we let the user attach; others are rejected before upload. */
const ALLOWED = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i;

let seq = 0;

interface Pending {
  resolve: (ref: string) => void;
  reject: (err: Error) => void;
}

/** Returns an `upload(file)` that resolves to a markdown image ref, e.g. `assets/img-….png`. */
export function useImageUpload(): (file: File) => Promise<string> {
  const pending = useRef(new Map<string, Pending>());

  useEffect(() => {
    const off = onHostMessage((m: HostMessage) => {
      if (m.type !== 'imageSaved') {
        return;
      }
      const p = pending.current.get(m.requestId);
      if (!p) {
        return;
      }
      pending.current.delete(m.requestId);
      if (m.ref) {
        p.resolve(m.ref);
      } else {
        p.reject(new Error(m.error || 'Failed to save image.'));
      }
    });
    // Reject anything still in flight if the component unmounts.
    const inFlight = pending.current;
    return () => {
      off();
      inFlight.forEach((p) => p.reject(new Error('Upload cancelled.')));
      inFlight.clear();
    };
  }, []);

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
        const requestId = `img-${Date.now()}-${++seq}`;
        pending.current.set(requestId, { resolve, reject });
        post({ type: 'saveImage', requestId, dataBase64: base64, ext: file.type });
      };
      reader.readAsDataURL(file);
    });
  }, []);
}
