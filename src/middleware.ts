// Security response headers, chiefly the Content-Security-Policy.
//
// Why this matters here specifically: task descriptions, notes and client notes are
// user Markdown rendered through `dangerouslySetInnerHTML` by a hand-rolled renderer
// (ui/utils/markdown), and the session cookie holds a GitHub token with the `repo`
// scope. One escaping miss in that renderer would otherwise reach every repository
// the user owns. The CSP is the backstop that keeps a rendering bug from becoming an
// account compromise.
//
// Astro 5's `experimental.csp` is the obvious alternative — it hashes the inline
// scripts it emits — but it produces no policy at all under the Cloudflare SSR
// adapter (verified on 5.18: neither `csp: true` nor the object form emits the
// meta element). It also delivers via <meta>, which silently drops `frame-ancestors`.
// So the policy is built here instead.
//
// The inline-script problem: hydrating the React island needs two <script> blocks
// that Astro generates and inlines, and their contents change whenever Astro is
// upgraded. Hard-coding their hashes would mean the app breaks on a dependency bump,
// in a way that only shows up as a blank page in production. So the hashes are
// computed from the response that is actually being sent. The policy can never drift
// out of sync with the markup, and no `'unsafe-inline'` is needed for scripts —
// which is the part of the CSP doing the real work.

import { defineMiddleware } from 'astro:middleware';

/** Inline `<script>`/`<style>` blocks, capturing the tag attributes and the body. */
const INLINE_BLOCK = /<(script|style)([^>]*)>([\s\S]*?)<\/\1>/gi;
/** A `src`/`href` means the browser fetches it separately; `'self'` covers those. */
const HAS_SOURCE = /\s(?:src|href)\s*=/i;

/** The CSP hash-source for one inline block's exact contents. */
async function hashOf(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `'sha256-${btoa(binary)}'`;
}

/** Hash every inline script and style in the document, keyed by tag. */
async function inlineHashes(html: string): Promise<{ script: string[]; style: string[] }> {
  const bodies = { script: new Set<string>(), style: new Set<string>() };
  for (const [, tag, attrs, body] of html.matchAll(INLINE_BLOCK)) {
    if (!HAS_SOURCE.test(attrs)) {
      bodies[tag.toLowerCase() as 'script' | 'style'].add(body);
    }
  }
  return {
    script: await Promise.all([...bodies.script].map(hashOf)),
    style: await Promise.all([...bodies.style].map(hashOf)),
  };
}

// `astro dev` serves CSS through JS: Vite injects a <style> element per module at
// runtime, and the dev toolbar builds its shadow DOM the same way. None of that is in
// the SSR response, so hashing the response covers none of it and the whole app loads
// unstyled. Dev gets `'unsafe-inline'` for styles; production keeps the hashes, and
// `npm run build && npm run preview` is where the real policy gets exercised.
const DEV = import.meta.env.DEV;

function policy(hashes: { script: string[]; style: string[] }): string {
  return [
    "default-src 'self'",
    // The bundled island chunks under /_astro, plus the exact inline blocks in this
    // response. No `'unsafe-inline'`: a hash-source would make the browser ignore it
    // anyway, and this is the directive that contains an XSS in the Markdown renderer.
    `script-src 'self' ${hashes.script.join(' ')}`.trim(),
    // A hash-source makes the browser ignore `'unsafe-inline'`, so dev omits the
    // hashes entirely rather than listing both.
    DEV ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' ${hashes.style.join(' ')}`.trim(),
    // Tailwind arbitrary values and React `style={{…}}` props both land as style
    // attributes, which cannot be hashed. Scoping the exemption to `style-src-attr`
    // keeps it away from <style> elements, where injected CSS could actually be used
    // to exfiltrate content via selectors and background-image requests.
    "style-src-attr 'unsafe-inline'",
    // Markdown may reference any https image; `data:` covers pasted URIs and `blob:`
    // the object URLs that assets/ bytes are served through (see data/assetUrls).
    "img-src 'self' https: data: blob:",
    // Everything the client fetches is one of our own /api/* routes.
    "connect-src 'self'",
    // Astro's font provider downloads and self-hosts these under /_astro/fonts.
    "font-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    // Clickjacking: nothing here should ever be framed. This is the directive a
    // <meta>-delivered policy would have dropped.
    "frame-ancestors 'none'",
  ].join('; ');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Headers with no <meta> equivalent, applied to everything including /api/*.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Repo owner and name sit in the app's URLs; don't hand them to third parties.
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // For browsers predating `frame-ancestors`.
  response.headers.set('X-Frame-Options', 'DENY');

  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) {
    // An API response has no inline anything to hash, but it can still be framed
    // or sniffed, so it gets the directives that apply without a document.
    response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'");
    return response;
  }

  // Reading the body to hash it means the document is no longer streamed to the
  // browser. These pages are small and server-rendered in one pass, so the cost is
  // a few milliseconds — worth paying for a script-src that can't rot. Revisit if a
  // page ever gets big enough for time-to-first-byte to matter.
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy(await inlineHashes(html)));
  headers.delete('content-length'); // recomputed by the runtime for the new body

  return new Response(html, { status: response.status, statusText: response.statusText, headers });
});
