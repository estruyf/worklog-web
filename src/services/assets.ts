// Persists images pasted/dropped/picked in a task description, and arbitrary
// files attached to a task. Bytes arrive from the UI as base64, are written to
// the in-memory `assets/` folder (committed to the repo on the next sync), and
// the markdown gets an `assets/<file>` reference that the UI resolves back to a
// raw GitHub URL for display.

import { Store } from '../store';
import { ensureDir, fileMap, writeBytes } from '../workspace/paths';

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

/** The picked file's name as an `assets/` filename: basename only, no hidden-file
 *  dot, and nothing outside `[\w.-]` — so the ref stays one unambiguous token on
 *  its `- attachment:` line and matches the renderer's flat `assets/<file>` shape. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+\./g, '.')
    .replace(/^[-.]+/, '')
    .replace(/-+$/, '')
    .slice(0, 80);
  return cleaned || 'file';
}

/** `name`, or `name-2`, `name-3`, … — the first not already taken in the file
 *  map or on the branch. Attachments keep their human-readable filename (unlike
 *  the single-use generated image names), so collisions are real. */
function uniqueAssetName(name: string): string {
  const fm = fileMap();
  const taken = (n: string) => {
    const path = `assets/${n}`;
    return fm.binary.has(path) || fm.text.has(path) || fm.baseSha.has(path);
  };
  if (!taken(name)) {
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; ; i++) {
    const next = `${stem}-${i}${ext}`;
    if (!taken(next)) {
      return next;
    }
  }
}

/** Decode a base64 file, write it under `assets/` keeping its (sanitized)
 *  filename, and return its ref. Any file type: attachments are downloaded,
 *  never rendered, so the name is the only thing the extension has to serve. */
export async function saveFileAsset(store: Store, fileName: string, dataBase64: string): Promise<string> {
  const bytes = base64ToBytes(dataBase64);
  if (bytes.length === 0) {
    throw new Error('The file was empty.');
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error('File is too large (max 10 MB).');
  }
  await ensureDir(store.ws.assetsDir);
  const name = uniqueAssetName(sanitizeFileName(fileName));
  await writeBytes(`${store.ws.assetsDir}/${name}`, bytes);
  return `assets/${name}`;
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
