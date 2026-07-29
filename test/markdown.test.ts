// Image handling in the description renderer. Stored images are `assets/<file>`
// refs resolved through the store's in-memory bytes — the renderer must hand the
// whole ref to that lookup (an earlier version dropped the `assets/` segment, so
// every pasted image rendered broken) and block anything else.

import { describe, it, expect } from 'vitest';
import { makeImageResolver, renderMarkdown } from '../src/ui/utils/markdown';

describe('makeImageResolver', () => {
  it('passes the full assets ref to the lookup', () => {
    const seen: string[] = [];
    const resolve = makeImageResolver((ref) => {
      seen.push(ref);
      return `blob:fake/${ref}`;
    });
    expect(resolve('assets/img-abc-123.png')).toBe('blob:fake/assets/img-abc-123.png');
    expect(seen).toEqual(['assets/img-abc-123.png']);
  });

  it('blocks the image when the lookup has no bytes for it', () => {
    const resolve = makeImageResolver(() => null);
    expect(resolve('assets/missing.png')).toBeNull();
  });

  it('passes through http(s) and data URLs without a lookup', () => {
    const resolve = makeImageResolver(() => null);
    expect(resolve('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(resolve('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('blocks paths outside assets/, including traversal', () => {
    const resolve = makeImageResolver(() => 'blob:leaked');
    expect(resolve('../.worklog/config.json')).toBeNull();
    expect(resolve('assets/../.worklog/config.json')).toBeNull();
    expect(resolve('/etc/passwd')).toBeNull();
    expect(resolve('clients/acme.md')).toBeNull();
  });
});

describe('renderMarkdown images', () => {
  it('renders a pasted image ref as an <img> pointing at the resolved URL', () => {
    const html = renderMarkdown('![](assets/img-abc-123.png)', () => 'blob:fake/1');
    expect(html).toBe('<p><img src="blob:fake/1" alt="" class="wl-md-img" /></p>');
  });

  it('falls back to the alt text when the image is blocked', () => {
    const html = renderMarkdown('![a diagram](assets/gone.png)', () => null);
    expect(html).toBe('<p>a diagram</p>');
  });
});
