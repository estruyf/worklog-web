// Object URLs for the images the markdown renderer asks for.
//
// Assets are served from the in-memory bytes rather than a raw GitHub URL so a
// just-pasted image renders before it is ever committed, and so images in a
// private repo render at all (raw URLs there need a token an `<img>` can't send).
// `URL.createObjectURL` leaks until revoked, so the URLs are cached per path and
// revoked together when the file map they point into is replaced.

export class AssetUrlCache {
  /** `assets/<file>` -> object URL handed to the markdown renderer. */
  private urls = new Map<string, string>();

  /** The cached URL for a ref, creating one from `bytes` on first ask. `null`
   *  when the file map doesn't hold the ref. */
  urlFor(ref: string, bytes: Uint8Array | undefined): string | null {
    const cached = this.urls.get(ref);
    if (cached) {
      return cached;
    }
    if (!bytes) {
      return null;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeOfAsset(ref) }));
    this.urls.set(ref, url);
    return url;
  }

  /** Drop every URL. Call before the bytes they point at go away. */
  revokeAll(): void {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
  }
}

/** Content type for an asset path, from its extension (see services/assets for
 *  the extensions written). Unknown ones fall back to PNG, matching that writer. */
export function mimeOfAsset(path: string): string {
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}
