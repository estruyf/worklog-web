// Base64 <-> bytes for the binary files (images under assets/) that travel as
// base64 in three places: the /api/load response, the /api/commit payload, and
// the IndexedDB recovery snapshot. Byte-at-a-time on purpose — `String.fromCharCode`
// with a spread blows the argument limit on anything but a small image.

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
