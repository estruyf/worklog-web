// Persists images pasted/dropped/picked in a task description. Bytes arrive from
// the UI as base64, are written to the in-memory `assets/` folder (committed to
// the repo on the next sync), and the markdown gets an `assets/<file>` reference
// that the UI resolves back to a raw GitHub URL for display.

import { Store } from '../store';
import { ensureDir, writeBytes } from '../workspace/paths';

/** Image types we accept, mapped to the on-disk extension. */
const EXT_BY_TYPE: Record<string, string> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  svg: 'svg',
  'svg+xml': 'svg',
};

/** Guard against oversized payloads bloating the markdown store (~10 MB decoded). */
const MAX_BYTES = 10 * 1024 * 1024;

function normalizeExt(ext: string): string {
  const key = ext.trim().toLowerCase().replace(/^\./, '').replace(/^image\//, '');
  return EXT_BY_TYPE[key] ?? 'png';
}

/** Decode a base64 string to bytes using the Web-standard `atob`. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Decode a base64 image, write it under `assets/`, and return its markdown ref. */
export async function saveImageAsset(store: Store, dataBase64: string, ext: string): Promise<string> {
  const bytes = base64ToBytes(dataBase64);
  if (bytes.length === 0) {
    throw new Error('The pasted image was empty.');
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error('Image is too large (max 10 MB).');
  }
  await ensureDir(store.ws.assetsDir);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const name = `img-${stamp}-${rand}.${normalizeExt(ext)}`;
  await writeBytes(`${store.ws.assetsDir}/${name}`, bytes);
  return `assets/${name}`;
}
