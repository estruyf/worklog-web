// Syntax highlighting for fenced code blocks: what the renderer does with the
// tokens, and that the real Shiki path actually produces them.
//
// The two halves are deliberately separate. The renderer is tested with a stub
// highlighter, because the thing worth pinning there is the escaping — a token's
// text and its style both end up inside markup that goes to
// `dangerouslySetInnerHTML`. The Shiki half then runs for real (no network: the
// grammars and the two themes are files in node_modules and src), since a
// highlighter that loads no grammar would still pass every test above it.

import { describe, it, expect } from 'vitest';
import { renderMarkdown, type CodeHighlighter } from '../src/ui/utils/markdown';
import { highlightCode, subscribeHighlight } from '../src/ui/utils/highlight';

/** One span per token, so a test can read the structure back out. */
const stub: CodeHighlighter = (code, lang) =>
  lang === 'ts' ? code.split('\n').map((line) => [{ text: line, style: '--shiki-light:#000' }]) : null;

/** The button as `renderMarkdown` writes it, pinned here rather than re-derived:
 *  `MarkdownView` finds it by `data-md-copy` and copies the `<pre>` beside it. */
const COPY_BUTTON_MARKUP =
  '<button type="button" class="wl-md-copy" data-md-copy aria-label="Copy code" title="Copy code">' +
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<g class="wl-md-copy-idle"><rect x="8" y="8" width="14" height="14" rx="2" />' +
  '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></g>' +
  '<path class="wl-md-copy-done" d="M20 6 9 17l-5-5" />' +
  '</svg></button>';

/** Resolves when the grammar a `highlightCode` call asked for has landed. */
function whenLoaded(code: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    const stop = subscribeHighlight(() => {
      stop();
      resolve();
    });
    highlightCode(code, lang);
  });
}

describe('rendering a highlighted fence', () => {
  it('asks the highlighter for a fence that named its language', () => {
    expect(renderMarkdown('```ts\nconst a = 1\n```', undefined, { highlight: stub })).toBe(
      '<div class="wl-md-code-block"><pre class="wl-md-pre"><code class="wl-md-codeblock"><span style="--shiki-light:#000">const a = 1</span></code></pre></div>',
    );
  });

  it('leaves a fence with no language plain, rather than guessing at one', () => {
    const seen: string[] = [];
    renderMarkdown('```\nconst a = 1\n```', undefined, {
      highlight: (code, lang) => {
        seen.push(lang);
        return null;
      },
    });
    expect(seen).toEqual([]);
  });

  it('renders plain text when the highlighter has nothing for that language', () => {
    expect(renderMarkdown('```klingon\nnuqneH\n```', undefined, { highlight: stub })).toBe(
      '<div class="wl-md-code-block"><pre class="wl-md-pre"><code class="wl-md-codeblock">nuqneH</code></pre></div>',
    );
  });

  it('keeps the line structure', () => {
    const html = renderMarkdown('```ts\nconst a = 1\nconst b = 2\n```', undefined, { highlight: stub });
    expect(html).toContain('>const a = 1</span>\n<span');
  });

  it('escapes the token text, so highlighting cannot open a hole the plain path closes', () => {
    const html = renderMarkdown('```ts\n<script>alert(1)</script>\n```', undefined, { highlight: stub });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes the style the highlighter asks for', () => {
    const html = renderMarkdown('```ts\nx\n```', undefined, {
      highlight: () => [[{ text: 'x', style: '--shiki-light:"><img src=x onerror=alert(1)>' }]],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&quot;&gt;&lt;img');
  });

  it('is off by default, so the renderer\'s other callers get the plain block', () => {
    expect(renderMarkdown('```ts\nconst a = 1\n```')).toBe(
      '<div class="wl-md-code-block"><pre class="wl-md-pre"><code class="wl-md-codeblock">const a = 1</code></pre></div>',
    );
  });
});

describe('the copy button', () => {
  it('is off by default, since the click is the caller\'s to handle', () => {
    expect(renderMarkdown('```\nls -la\n```')).not.toContain('data-md-copy');
  });

  it('sits outside the code, so it stays put and stays out of what is copied', () => {
    const html = renderMarkdown('```\nls -la\n```', undefined, { copyableCode: true });
    expect(html).toBe(
      '<div class="wl-md-code-block"><pre class="wl-md-pre"><code class="wl-md-codeblock">ls -la</code></pre>' +
        COPY_BUTTON_MARKUP +
        '</div>',
    );
  });

  it('is on every block, highlighted or not', () => {
    const html = renderMarkdown('```ts\nconst a = 1\n```\n\n```\nplain\n```', undefined, {
      copyableCode: true,
      highlight: stub,
    });
    expect(html.match(/data-md-copy/g)).toHaveLength(2);
  });
});

describe('highlightCode', () => {
  it('never highlights a language it carries no grammar for', () => {
    expect(highlightCode('nuqneH', 'klingon')).toBeNull();
  });

  it('renders plain until the grammar lands, then tokenizes with both themes', async () => {
    // The first call can only start the fetch: the whole point of the null is
    // that a block shows as plain text rather than blocking a render on a chunk.
    expect(highlightCode('const a = 1', 'ts')).toBeNull();

    await whenLoaded('const a = 1', 'ts');

    const lines = highlightCode('const a = 1', 'ts');
    expect(lines).toHaveLength(1);
    const keyword = lines![0][0];
    expect(keyword.text).toBe('const');
    // Both themes in the markup is what makes the setting a CSS switch.
    expect(keyword.style).toContain('--shiki-light:');
    expect(keyword.style).toContain('--shiki-dark:');
    // And the tokens still add up to the code that went in.
    expect(lines!.map((line) => line.map((t) => t.text).join('')).join('\n')).toBe('const a = 1');
  });

  it('reads an alias as the language it names', async () => {
    await whenLoaded('echo hi', 'shell');
    expect(highlightCode('echo hi', 'sh')).not.toBeNull();
    expect(highlightCode('echo hi', 'bash')).not.toBeNull();
    expect(highlightCode('echo hi', 'ZSH')).not.toBeNull();
  });
});
