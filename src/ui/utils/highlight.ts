// Syntax highlighting for fenced code blocks, over Shiki's fine-grained bundle.
//
// Everything here is lazy: the highlighter, the two themes and a language's
// grammar are fetched the first time a block in that language renders. Until the
// chunk lands `highlightCode` returns null and the block shows as plain text —
// the same answer a fence with no language, or one this app carries no grammar
// for, gets permanently. The app island is `client:only`, so none of this can
// reach the worker bundle.
//
// Both themes are tokenized at once. A token carries `--shiki-light` /
// `--shiki-dark` custom properties rather than a colour, which makes the
// `codeTheme` setting a pure CSS switch (see styles.css): changing it re-paints
// without re-highlighting a thing.
//
// It hands back tokens, not HTML. Every string that reaches
// `dangerouslySetInnerHTML` is assembled and escaped in `renderMarkdown`, and
// this is not the reason to start a second place that does it.
//
// The themes in ./code-themes are the VS Code "Demo Time Light" / "Demo Time
// Dark" themes (MIT, github.com/estruyf/vscode-demotime-theme), trimmed to the
// token colours and the two editor colours Shiki reads. The non-italic variants
// on purpose: the app loads JetBrains Mono in `normal` only, so the italic ones
// would render as faux oblique.

import type { HighlighterCore, ThemedToken, ThemeRegistrationRaw } from "shiki/core";

/** One run of same-styled text on a line. `style` is the inline CSS custom
 *  properties for both themes, e.g. `--shiki-light:#D63384;--shiki-dark:#ED217C`. */
export interface CodeToken {
  text: string;
  style: string;
}

// One dynamic import per language, written out rather than built from a template
// string: an `import(`shiki/langs/${id}.mjs`)` would make the bundler ship all
// 700 of them. Adding a language here is adding a chunk, and nothing else.
const LOADERS = {
  bash: () => import("shiki/langs/bash.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  ini: () => import("shiki/langs/ini.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
};

type LangId = keyof typeof LOADERS;

/** What people actually type after the opening fence, mapped to the grammar that
 *  reads it. Anything not in here renders as plain text: guessing at the language
 *  would colour the code wrong, which is worse than not colouring it. */
const ALIASES: Record<string, LangId> = {
  bash: "bash",
  cjs: "javascript",
  console: "bash",
  css: "css",
  docker: "dockerfile",
  dockerfile: "dockerfile",
  html: "html",
  ini: "ini",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  markdown: "markdown",
  md: "markdown",
  mjs: "javascript",
  sh: "bash",
  shell: "bash",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

const THEMES = { light: "demo-time-light", dark: "demo-time-dark" } as const;

/** A VS Code theme file as Shiki's theme input. The JSON holds its rules under
 *  `tokenColors`, which Shiki reads and normalizes but its type only names as
 *  `settings` — hence the cast, which is the whole reason this is a function. */
function asTheme(mod: { default: unknown }): ThemeRegistrationRaw {
  return mod.default as ThemeRegistrationRaw;
}

let core: Promise<HighlighterCore> | null = null;
/** The resolved `core`, so a hit can be answered inside a render. */
let highlighter: HighlighterCore | null = null;
const loaded = new Set<LangId>();
const requested = new Set<LangId>();
/** Never asked for twice: a chunk that failed to load will not start to. */
const failed = new Set<LangId>();

const listeners = new Set<() => void>();
let version = 0;

function createCore(): Promise<HighlighterCore> {
  return Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("./code-themes/demo-time-light.json"),
    import("./code-themes/demo-time-dark.json"),
  ]).then(async ([{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark]) => {
    // The JavaScript regex engine rather than the Oniguruma one: the WebAssembly
    // build would need `wasm-unsafe-eval` in the CSP, and every grammar loaded
    // here works without it.
    highlighter = await createHighlighterCore({
      themes: [asTheme(light), asTheme(dark)],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
    return highlighter;
  });
}

/** Fetch a grammar, once, and tell the subscribers when it is usable. */
function request(id: LangId): void {
  if (requested.has(id)) {
    return;
  }
  requested.add(id);
  void (core ??= createCore())
    .then(async (hi) => {
      hi.loadLanguageSync((await LOADERS[id]()).default);
      loaded.add(id);
      version++;
      for (const listener of listeners) {
        listener();
      }
    })
    .catch(() => failed.add(id));
}

function styleOf(htmlStyle: ThemedToken["htmlStyle"]): string {
  if (!htmlStyle) {
    return "";
  }
  return typeof htmlStyle === "string"
    ? htmlStyle
    : Object.entries(htmlStyle)
        .map(([prop, value]) => `${prop}:${value}`)
        .join(";");
}

// Re-tokenizing is ~8ms for a 40-line block, and one DataContext means every
// rendered description re-renders on any edit anywhere in the app. Bounded
// because the key is the text itself: an edited block is a new entry, and the
// oldest (a Map keeps insertion order) is the one furthest from what is on screen.
const CACHE_LIMIT = 200;
const cache = new Map<string, CodeToken[][]>();

/**
 * Tokens for a fenced block, or null when it should render as plain text: an
 * unknown language, or a grammar still on its way. Safe to call from a render —
 * the fetch it may start is idempotent, and finishing it notifies
 * {@link subscribeHighlight} rather than throwing back into this call.
 */
export function highlightCode(code: string, lang: string): CodeToken[][] | null {
  const id = ALIASES[lang.trim().toLowerCase()];
  if (!id || failed.has(id)) {
    return null;
  }
  const key = `${id} ${code}`;
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  if (!highlighter || !loaded.has(id)) {
    request(id);
    return null;
  }
  const { tokens } = highlighter.codeToTokens(code, { lang: id, themes: THEMES, defaultColor: false });
  const lines = tokens.map((line) => line.map((token) => ({ text: token.content, style: styleOf(token.htmlStyle) })));
  cache.set(key, lines);
  if (cache.size > CACHE_LIMIT) {
    cache.delete(cache.keys().next().value!);
  }
  return lines;
}

/** Re-render on the arrival of a grammar an earlier call had to render plain. */
export function subscribeHighlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The counter `useSyncExternalStore` watches, bumped once per grammar loaded. */
export function highlightVersion(): number {
  return version;
}
