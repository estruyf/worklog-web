// Base64 <-> bytes for the binary files (images under assets/) that travel as
// base64 in three places: the /api/load response, the /api/commit payload, and
// the IndexedDB recovery snapshot.

/** How many bytes go into one `String.fromCharCode` call. Spreading a whole image
 *  blows the argument limit; going a byte at a time costs one string concatenation
 *  per byte, which is ~10M of them for a 10 MB paste — and `bytesToBase64` runs on
 *  every debounced persist while that image is still unsynced. 32k arguments is
 *  comfortably under every engine's limit and makes the concatenations negligible. */
const CHUNK_SIZE = 0x8000;

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)));
  }
  return btoa(parts.join(''));
}
