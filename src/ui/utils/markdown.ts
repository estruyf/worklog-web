// A tiny, dependency-free Markdown -> HTML renderer for task descriptions.
// Deliberately minimal (headings, emphasis, code, links and bare URLs, lists,
// quotes, rules).
// Block structure is detected on the raw lines; all user text is escaped inside
// inline() before any formatting, so the output is safe to inject into the
// app. The source of truth stays the markdown body in the client file.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resolves a Markdown image `src` to a URL the app may load, or `null` to
 * block it (the alt text is shown instead). Callers pass one built over the
 * store's asset lookup so stored `assets/…` refs become loadable URLs.
 */
export type ImageResolver = (src: string) => string | null;

/**
 * Builds an {@link ImageResolver} that passes through http(s)/data URLs and hands
 * stored `assets/<file>` refs to `lookup` — the store resolves them against the
 * in-memory bytes, so an image shows the moment it is pasted and keeps showing in
 * a private repo (a raw.githubusercontent URL would need auth and a pushed
 * commit). Anything else (bare relative/absolute paths) is blocked so
 * descriptions can't reach into the app via crafted markdown.
 */
export function makeImageResolver(
  lookup: (ref: string) => string | null,
): ImageResolver {
  return (src) => {
    if (/^(https?:|data:)/i.test(src)) {
      return src;
    }
    // Only a flat `assets/<file>` ref resolves — no path traversal.
    return /^assets\/[^/]+$/.test(src) ? lookup(src) : null;
  };
}

const count = (s: string, ch: string) => s.split(ch).length - 1;

/**
 * Trailing prose is not part of the URL: the full stop ending a sentence, the
 * `)` closing "(see https://x)", the `&gt;` left by an escaped `<https://x>`.
 * A closing bracket is only prose when the URL has no opener to match it, so
 * `https://en.wikipedia.org/wiki/Foo_(bar)` keeps its own. Returns `""` when
 * nothing usable is left, which keeps the text unlinked.
 */
function trimUrlTail(url: string): string {
  let out = url;
  for (;;) {
    const entity = /&(?:gt|lt|quot|amp|#\d+);$/.exec(out);
    if (entity) {
      out = out.slice(0, entity.index);
      continue;
    }
    const last = out.slice(-1);
    if (".,;:!?'".includes(last)) {
      out = out.slice(0, -1);
      continue;
    }
    const opener = last === ")" ? "(" : last === "]" ? "[" : null;
    if (opener && count(out, last) > count(out, opener)) {
      out = out.slice(0, -1);
      continue;
    }
    break;
  }
  return /^https?:\/\/[^\s]/.test(out) ? out : "";
}

/** Linkify bare URLs in a run of already-escaped text. */
function linkifyText(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/g, (match) => {
    const url = trimUrlTail(match);
    if (!url) {
      return match;
    }
    return `<a href="${url}" target="_blank" rel="noreferrer noopener" class="wl-md-link">${url}</a>${match.slice(url.length)}`;
  });
}

// An `<a>`/`<code>` element and its contents, or any other single tag. Anything
// this matches is markup the autolinker must not touch.
const MARKUP = /<(a|code)\b[^>]*>[\s\S]*?<\/\1>|<[^>]*>/gi;

/**
 * A pasted `https://…` with no `[label](…)` around it is the common case in a
 * description or a note, so it links too. This runs over the assembled inline
 * HTML rather than the raw text, skipping markup: a URL that already became an
 * `href` or `src`, or that sits inside a code span, must survive untouched.
 */
function autolink(html: string): string {
  let out = "";
  let last = 0;
  MARKUP.lastIndex = 0;
  for (let m = MARKUP.exec(html); m; m = MARKUP.exec(html)) {
    out += linkifyText(html.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + linkifyText(html.slice(last));
}

/** Escape, then apply inline spans: code, images, bold, italic, links. */
function inline(text: string, resolveImage?: ImageResolver): string {
  // `code` first so its contents are not further formatted.
  let out = escapeHtml(text).replace(
    /`([^`]+)`/g,
    (_m, c) => `<code class="wl-md-code">${c}</code>`,
  );
  // Images before links, since `![alt](src)` contains a link-shaped `[alt](src)`.
  out = out.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_m, alt, src) => {
    const resolved = resolveImage
      ? resolveImage(src)
      : /^(https?:|data:)/i.test(src)
        ? src
        : null;
    return resolved
      ? `<img src="${resolved}" alt="${alt}" class="wl-md-img" />`
      : alt;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // [label](url) — only http(s) / mailto links are linkified.
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    (_m, label, url) => {
      return `<a href="${url}" target="_blank" rel="noreferrer noopener" class="wl-md-link">${label}</a>`;
    },
  );
  return autolink(out);
}

export function renderMarkdown(
  md: string,
  resolveImage?: ImageResolver,
): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  let codeFence: string[] | null = null;

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "), resolveImage)}</p>`);
      paragraph = [];
    }
  };
  const flushCodeFence = () => {
    if (codeFence) {
      html.push(
        `<pre class="wl-md-pre"><code class="wl-md-codeblock">${escapeHtml(codeFence.join("\n"))}</code></pre>`,
      );
      codeFence = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (codeFence) {
      if (/^```\s*$/.test(line)) {
        flushCodeFence();
      } else {
        codeFence.push(raw);
      }
      continue;
    }

    if (/^```(?:\s*\S+)?\s*$/.test(line)) {
      flushParagraph();
      closeList();
      codeFence = [];
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(
        `<h${level} class="wl-md-h${level}">${inline(heading[2], resolveImage)}</h${level}>`,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      closeList();
      html.push('<hr class="wl-md-hr" />');
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(
        `<blockquote class="wl-md-quote">${inline(quote[1], resolveImage)}</blockquote>`,
      );
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushParagraph();
      const want: "ul" | "ol" = ul ? "ul" : "ol";
      if (listType !== want) {
        closeList();
        listType = want;
        html.push(`<${want} class="wl-md-list">`);
      }
      html.push(`<li>${inline(ul ? ul[1] : ol![1], resolveImage)}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  flushCodeFence();
  return html.join("\n");
}
