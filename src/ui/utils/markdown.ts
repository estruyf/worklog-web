// A tiny, dependency-free Markdown -> HTML renderer for task descriptions.
// Deliberately minimal (headings, emphasis, code, links and bare URLs, lists,
// task lists, quotes, rules).
// Block structure is detected on the raw lines; all user text is escaped inside
// inline() before any formatting, so the output is safe to inject into the
// app. The source of truth stays the markdown body in the client file.
//
// Task list items are the one thing here that writes back: a rendered checkbox
// carries the index of the line it came from, and {@link toggleTaskLine} flips
// that one line in the *source* markdown. The DOM is never the source of truth —
// see MarkdownView.
//
// `#t_a1b2c3` task references are resolved rather than parsed: the id is all the
// Markdown stores, and the title comes from whoever passes `resolveTaskRef`. The
// syntax itself lives in ./taskRefs, shared with the picker that writes them.

import type { CodeToken } from "./highlight";
import { TASK_REF } from "./taskRefs";

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
// this matches is markup the text passes below must not touch.
const MARKUP = /<(a|code)\b[^>]*>[\s\S]*?<\/\1>|<[^>]*>/gi;

/**
 * Rewrite the text runs of assembled inline HTML, leaving markup alone: a URL
 * that already became an `href` or `src`, or anything sitting inside a code
 * span, must survive untouched. Both passes below run over the *output* of the
 * inline formatting rather than the raw text, for exactly that reason.
 */
function mapText(html: string, fn: (text: string) => string): string {
  let out = "";
  let last = 0;
  MARKUP.lastIndex = 0;
  for (let m = MARKUP.exec(html); m; m = MARKUP.exec(html)) {
    out += fn(html.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + fn(html.slice(last));
}

/**
 * A pasted `https://…` with no `[label](…)` around it is the common case in a
 * description or a note, so it links too.
 */
function autolink(html: string): string {
  return mapText(html, linkifyText);
}

/**
 * Resolves a `#t_a1b2c3` task reference to what it should read as, or `null`
 * when nothing has that id. Callers build one over the loaded tasks.
 */
export type TaskRefResolver = (
  id: string,
) => { title: string; done: boolean } | null;

/**
 * `#t_a1b2c3` — a reference to another task, rendered as that task's *current*
 * title, which is the whole reason the Markdown stores only the id.
 *
 * A ref nothing resolves stays literal text: a deleted task, or a `#` that only
 * looks like one, is the user's own writing, and inventing a dead link for it
 * would be worse than showing what they typed. The `href` is the task's real
 * route so a modified click and "open in new tab" work; the app intercepts the
 * plain one (see MarkdownView).
 *
 * Runs after {@link autolink}, so a `#t_…` fragment inside a URL is already
 * inside an `<a>` by the time this pass looks at the text.
 */
function linkifyTaskRefs(html: string, resolve: TaskRefResolver): string {
  return mapText(html, (text) =>
    text.replace(TASK_REF, (match, id: string) => {
      const task = resolve(id);
      if (!task) {
        return match;
      }
      const cls = task.done
        ? "wl-md-taskref wl-md-taskref-done"
        : "wl-md-taskref";
      return `<a href="/app/task/${id}" data-task-ref="${id}" class="${cls}" title="${match}">${escapeHtml(task.title)}</a>`;
    }),
  );
}

/** Escape, then apply inline spans: code, images, bold, italic, links, refs. */
function inline(
  text: string,
  resolveImage?: ImageResolver,
  resolveTaskRef?: TaskRefResolver,
): string {
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
  out = autolink(out);
  return resolveTaskRef ? linkifyTaskRefs(out, resolveTaskRef) : out;
}

/**
 * The checkbox part of a task list item, matched against a `ul` item's text.
 * `[]` is not GitHub-flavoured Markdown, but it is what people type when they
 * write the list by hand, so it reads as unchecked rather than as literal text.
 */
const TASK_ITEM = /^\[([ xX]?)\]\s+(.*)$/;

/**
 * The same marker on a whole source line — what {@link toggleTaskLine} edits.
 * Indentation is part of the captured prefix: a nested item renders as a live
 * checkbox like any other, so it has to be togglable like any other.
 */
const TASK_LINE = /^(\s*[-*]\s+\[)([ xX]?)\]/;

/**
 * Flip the `[ ]`/`[x]` on one line of `md`, identified by its zero-based line
 * index (the `data-md-line` a rendered checkbox carries). Returns `null` when
 * that line is not a task item any more — the text can have been edited since it
 * was rendered, and a stale index must not rewrite an unrelated line.
 *
 * Only the marker is touched, so line endings, indentation and the item's text
 * survive byte for byte: this text goes straight back into the user's Markdown.
 */
export function toggleTaskLine(md: string, lineIndex: number): string | null {
  // Split on "\n" alone, so a CRLF document keeps its "\r" at each line's end
  // and the indices still line up with the renderer's.
  const lines = md.split("\n");
  const line = lines[lineIndex];
  if (line === undefined) {
    return null;
  }
  const m = TASK_LINE.exec(line);
  if (!m) {
    return null;
  }
  const checked = m[2].toLowerCase() === "x";
  lines[lineIndex] =
    m[1] + (checked ? " " : "x") + line.slice(m[1].length + m[2].length);
  return lines.join("\n");
}

/**
 * The item's text with the inline syntax dropped — the checkbox's accessible
 * name, since the label sits beside it as rendered markup rather than in an
 * attribute.
 */
function plainText(md: string, resolveTaskRef?: TaskRefResolver): string {
  return md
    .replace(/!\[([^\]]*)\]\([^\s)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^\s)]*\)/g, "$1")
    // Read out as the task's title, the same as on screen: an id spelled letter
    // by letter is the least useful thing a screen reader could say here.
    .replace(TASK_REF, (match, id: string) => resolveTaskRef?.(id)?.title ?? match)
    .replace(/[`*_]/g, "")
    .trim();
}

/**
 * A task item's box. Interactive ones carry the source line for the click
 * handler to find; read-only ones are `disabled`, which is what a checkbox that
 * cannot be ticked has to say to a keyboard or a screen reader.
 */
function checkbox(
  mark: string,
  line: number,
  interactive: boolean | undefined,
  text: string,
  resolveTaskRef?: TaskRefResolver,
): string {
  const checked = mark.toLowerCase() === "x" ? " checked" : "";
  const state = interactive ? ` data-md-line="${line}"` : " disabled";
  return `<input type="checkbox" class="wl-md-check"${checked}${state} aria-label="${escapeHtml(plainText(text, resolveTaskRef))}" />`;
}

export interface MarkdownOptions {
  /**
   * Render task list items as live checkboxes carrying their source line index,
   * for a caller that can write the toggled text back. Off by default: a
   * checkbox nothing listens to would silently drop the click.
   */
  interactiveTasks?: boolean;
  /**
   * Turns `#t_a1b2c3` into a link to that task. Off by default: without a way to
   * look the id up there is no title to show, and the raw id is not text anyone
   * asked for.
   */
  resolveTaskRef?: TaskRefResolver;
  /**
   * Syntax-highlights a fenced block that named its language. Returns the lines
   * of tokens rather than markup, so the escaping stays in this file; null (and
   * the default) renders the block as plain text.
   */
  highlight?: CodeHighlighter;
  /**
   * Put a copy button on every fenced block. Off by default, for the reason
   * `interactiveTasks` is: the click is delegated, so a caller that does not
   * handle it would render a button that does nothing.
   */
  copyableCode?: boolean;
}

/** See {@link MarkdownOptions.highlight}. `ui/utils/highlight` is the one this
 *  app passes; `lang` is the fence's info word, verbatim. */
export type CodeHighlighter = (code: string, lang: string) => CodeToken[][] | null;

/**
 * The copy button, markup and all. Hand-drawn rather than lucide (which the rest
 * of the app draws from) because this is a string, not React — the two glyphs
 * are Lucide's own `copy` and `check`, and CSS swaps them on `data-copied`.
 *
 * `data-md-copy` is what the click delegation looks for; the code it copies is
 * the `<pre>` beside it, which is why it sits outside rather than inside. Inside,
 * it would scroll away with the code and land in the text a copy returns.
 */
const COPY_BUTTON =
  '<button type="button" class="wl-md-copy" data-md-copy aria-label="Copy code" title="Copy code">' +
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<g class="wl-md-copy-idle"><rect x="8" y="8" width="14" height="14" rx="2" />' +
  '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></g>' +
  '<path class="wl-md-copy-done" d="M20 6 9 17l-5-5" />' +
  "</svg></button>";

export function renderMarkdown(
  md: string,
  resolveImage?: ImageResolver,
  options?: MarkdownOptions,
): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const refs = options?.resolveTaskRef;
  const html: string[] = [];
  // One entry per open list, outermost first. An item is emitted *unclosed*
  // because a deeper-indented line nests its list inside that same `<li>`, so
  // the `</li>` can only be written once the next line says where it belongs.
  const stack: { type: "ul" | "ol"; indent: number; itemOpen: boolean }[] = [];
  let paragraph: string[] = [];
  let codeFence: string[] | null = null;
  let codeLang = "";

  // Appended rather than pushed, so a flat list still renders one item per line.
  const closeItem = () => {
    const top = stack[stack.length - 1];
    if (top.itemOpen) {
      html[html.length - 1] += "</li>";
      top.itemOpen = false;
    }
  };
  const popList = () => {
    closeItem();
    html.push(`</${stack.pop()!.type}>`);
  };
  const closeList = () => {
    while (stack.length) {
      popList();
    }
  };
  /**
   * Makes the innermost open list the one an item at `indent` belongs to:
   * shallower closes lists, deeper opens one inside the item still open, and a
   * different marker at the same depth starts a sibling list.
   */
  const openListLevel = (indent: number, want: "ul" | "ol") => {
    while (stack.length && indent < stack[stack.length - 1].indent) {
      popList();
    }
    const top = stack[stack.length - 1];
    if (top && indent === top.indent && top.type === want) {
      closeItem();
      return;
    }
    if (top && indent === top.indent) {
      popList();
    }
    stack.push({ type: want, indent, itemOpen: false });
    html.push(`<${want} class="wl-md-list">`);
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "), resolveImage, refs)}</p>`);
      paragraph = [];
    }
  };
  const flushCodeFence = () => {
    if (codeFence) {
      const code = codeFence.join("\n");
      // Highlighted or not, the text is escaped here, and so is the style the
      // highlighter asks for — this is the markup that goes to innerHTML.
      const tokens = codeLang && options?.highlight ? options.highlight(code, codeLang) : null;
      const body = tokens
        ? tokens
            .map((line) =>
              line
                .map((token) => `<span style="${escapeHtml(token.style)}">${escapeHtml(token.text)}</span>`)
                .join(""),
            )
            .join("\n")
        : escapeHtml(code);
      const copy = options?.copyableCode ? COPY_BUTTON : "";
      html.push(
        `<div class="wl-md-code-block"><pre class="wl-md-pre"><code class="wl-md-codeblock">${body}</code></pre>${copy}</div>`,
      );
      codeFence = null;
      codeLang = "";
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, "");

    if (codeFence) {
      if (/^```\s*$/.test(line)) {
        flushCodeFence();
      } else {
        codeFence.push(raw);
      }
      continue;
    }

    const fence = /^```\s*(\S*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      closeList();
      codeFence = [];
      codeLang = fence[1];
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
        `<h${level} class="wl-md-h${level}">${inline(heading[2], resolveImage, refs)}</h${level}>`,
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
        `<blockquote class="wl-md-quote">${inline(quote[1], resolveImage, refs)}</blockquote>`,
      );
      continue;
    }

    const listItem = /^([ \t]*)(?:([-*])|\d+\.)\s+(.*)$/.exec(line);
    if (listItem) {
      flushParagraph();
      // Depth is the leading whitespace, with a tab worth the four spaces
      // CommonMark gives it — the two are mixed freely in hand-written lists.
      const indent = listItem[1].replace(/\t/g, "    ").length;
      const want: "ul" | "ol" = listItem[2] ? "ul" : "ol";
      openListLevel(indent, want);
      const item = listItem[3];
      const task = want === "ul" ? TASK_ITEM.exec(item) : null;
      if (task) {
        html.push(
          `<li class="wl-md-task">${checkbox(task[1], i, options?.interactiveTasks, task[2], refs)}<span>${inline(task[2], resolveImage, refs)}</span>`,
        );
      } else {
        html.push(`<li>${inline(item, resolveImage, refs)}`);
      }
      stack[stack.length - 1].itemOpen = true;
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  flushCodeFence();
  return html.join("\n");
}
