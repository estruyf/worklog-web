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

// Descriptions and notes are typed by hand and pasted into: a bare URL is far
// more common there than `[label](url)`, so it has to link on its own without
// double-linking one that markdown already handled.
describe('renderMarkdown bare URLs', () => {
  const linked = (url: string, label = url) =>
    `<a href="${url}" target="_blank" rel="noreferrer noopener" class="wl-md-link">${label}</a>`;

  it('links a bare http(s) URL', () => {
    expect(renderMarkdown('see https://example.com/a?b=1 now')).toBe(
      `<p>see ${linked('https://example.com/a?b=1')} now</p>`,
    );
  });

  it('keeps sentence punctuation and unbalanced brackets out of the href', () => {
    expect(renderMarkdown('(see https://example.com/a).')).toBe(`<p>(see ${linked('https://example.com/a')}).</p>`);
    expect(renderMarkdown('go to https://example.com/wiki/Foo_(bar)!')).toBe(
      `<p>go to ${linked('https://example.com/wiki/Foo_(bar)')}!</p>`,
    );
  });

  it('does not touch a URL markdown already linked', () => {
    expect(renderMarkdown('[docs](https://example.com/a)')).toBe(`<p>${linked('https://example.com/a', 'docs')}</p>`);
    expect(renderMarkdown('![](https://example.com/a.png)')).toBe(
      '<p><img src="https://example.com/a.png" alt="" class="wl-md-img" /></p>',
    );
  });

  it('leaves URLs inside code spans and fences alone', () => {
    expect(renderMarkdown('`https://example.com/a`')).toBe('<p><code class="wl-md-code">https://example.com/a</code></p>');
    expect(renderMarkdown('```\nhttps://example.com/a\n```')).toBe(
      '<pre class="wl-md-pre"><code class="wl-md-codeblock">https://example.com/a</code></pre>',
    );
  });

  it('escapes before linking, so a URL cannot inject markup', () => {
    const html = renderMarkdown('https://example.com/"><script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('href="https://example.com/&quot;&gt;&lt;script&gt;alert(1)&lt;/script"');
  });

  it('links bare URLs in headings, quotes and list items too', () => {
    expect(renderMarkdown('- https://example.com/a')).toBe(
      `<ul class="wl-md-list">\n<li>${linked('https://example.com/a')}</li>\n</ul>`,
    );
    expect(renderMarkdown('> https://example.com/a')).toBe(
      `<blockquote class="wl-md-quote">${linked('https://example.com/a')}</blockquote>`,
    );
  });

  it('ignores a scheme with nothing after it', () => {
    expect(renderMarkdown('https:// is a scheme')).toBe('<p>https:// is a scheme</p>');
  });
});
