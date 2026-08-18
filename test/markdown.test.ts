// Image handling in the description renderer. Stored images are `assets/<file>`
// refs resolved through the store's in-memory bytes — the renderer must hand the
// whole ref to that lookup (an earlier version dropped the `assets/` segment, so
// every pasted image rendered broken) and block anything else.

import { describe, it, expect } from 'vitest';
import { makeImageResolver, renderMarkdown, toggleTaskLine } from '../src/ui/utils/markdown';

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

// A checkbox is the one piece of rendered markup that writes back, so the line
// index it carries and the toggle that consumes it have to agree — including
// after blank lines, fences and headings have shifted the numbering.
describe('renderMarkdown task lists', () => {
  const box = (attrs: string, label: string) => `<input type="checkbox" class="wl-md-check"${attrs} aria-label="${label}" />`;

  it('renders read-only boxes by default', () => {
    expect(renderMarkdown('- [ ] ship it\n- [x] write it')).toBe(
      [
        '<ul class="wl-md-list">',
        `<li class="wl-md-task">${box(' disabled', 'ship it')}<span>ship it</span></li>`,
        `<li class="wl-md-task">${box(' checked disabled', 'write it')}<span>write it</span></li>`,
        '</ul>',
      ].join('\n'),
    );
  });

  it('carries the source line index when interactive', () => {
    const html = renderMarkdown('# Plan\n\n- [ ] first\n- [x] second', undefined, { interactiveTasks: true });
    expect(html).toContain(box(' data-md-line="2"', 'first'));
    expect(html).toContain(box(' checked data-md-line="3"', 'second'));
    expect(html).not.toContain('disabled');
  });

  it('reads the `[]` people type by hand as unchecked', () => {
    expect(renderMarkdown('- [] partials')).toContain(box(' disabled', 'partials'));
  });

  it('still formats and escapes the item text, and labels the box in plain text', () => {
    const html = renderMarkdown('- [ ] `--output json` on <status>');
    expect(html).toContain('<code class="wl-md-code">--output json</code> on &lt;status&gt;</span>');
    expect(html).toContain('aria-label="--output json on &lt;status&gt;"');
  });

  it('leaves ordinary list items and bracketed prose alone', () => {
    expect(renderMarkdown('- [docs](https://example.com)')).not.toContain('wl-md-task');
    expect(renderMarkdown('1. [ ] not a task list')).not.toContain('wl-md-task');
  });
});

// An indented item belongs *inside* the item above it. Before nesting existed
// the line fell through to a paragraph, so a two-level list rendered as prose
// with stray dashes in it.
describe('renderMarkdown nested lists', () => {
  it('nests a deeper item inside the item above it', () => {
    expect(renderMarkdown('- Global params\n  - Copy from an existing site\n- Apps')).toBe(
      [
        '<ul class="wl-md-list">',
        '<li>Global params',
        '<ul class="wl-md-list">',
        '<li>Copy from an existing site</li>',
        '</ul></li>',
        '<li>Apps</li>',
        '</ul>',
      ].join('\n'),
    );
  });

  it('switches list type per level and closes back out in order', () => {
    expect(renderMarkdown('- a\n  1. one\n- b')).toBe(
      [
        '<ul class="wl-md-list">',
        '<li>a',
        '<ol class="wl-md-list">',
        '<li>one</li>',
        '</ol></li>',
        '<li>b</li>',
        '</ul>',
      ].join('\n'),
    );
  });

  it('counts a tab as four spaces of depth', () => {
    expect(renderMarkdown('- a\n\t- deep')).toContain('<li>a\n<ul class="wl-md-list">\n<li>deep</li>');
  });

  it('leaves a flat list on one item per line', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul class="wl-md-list">\n<li>a</li>\n<li>b</li>\n</ul>');
  });

  it('gives a nested task item its own live checkbox', () => {
    const html = renderMarkdown('- [ ] top\n  - [x] nested', undefined, { interactiveTasks: true });
    expect(html).toContain('data-md-line="1"');
    expect(toggleTaskLine('- [ ] top\n  - [x] nested', 1)).toBe('- [ ] top\n  - [ ] nested');
  });
});

describe('toggleTaskLine', () => {
  const DOC = '# Plan\n\n- [ ] first\n- [x] second\n\nSome prose.';

  it('ticks and unticks the addressed line only', () => {
    expect(toggleTaskLine(DOC, 2)).toBe('# Plan\n\n- [x] first\n- [x] second\n\nSome prose.');
    expect(toggleTaskLine(DOC, 3)).toBe('# Plan\n\n- [ ] first\n- [ ] second\n\nSome prose.');
  });

  it('normalizes a hand-typed `[]` on the way through', () => {
    expect(toggleTaskLine('- [] partials', 0)).toBe('- [x] partials');
  });

  it('keeps CRLF line endings and the item text byte for byte', () => {
    expect(toggleTaskLine('- [ ] a\r\n- [ ] b\r\n', 1)).toBe('- [ ] a\r\n- [x] b\r\n');
  });

  it('refuses a stale index rather than rewriting whatever is there now', () => {
    expect(toggleTaskLine(DOC, 0)).toBeNull();
    expect(toggleTaskLine(DOC, 5)).toBeNull();
    expect(toggleTaskLine(DOC, 99)).toBeNull();
  });
});
