/* Worklog service worker.
 *
 * The app is server-rendered on Cloudflare, but everything it renders after the
 * first load comes from an in-memory file map backed by IndexedDB (see
 * data/repoCache and data/pendingStore). So the network is needed to *reach* the
 * app, not to use it — and that is the gap this closes:
 *
 *   - navigations under /app are cached as they succeed, and served from cache
 *     when the network is gone, so the app opens on a train and can take an edit
 *     that syncs on reconnect,
 *   - other navigations are network-first with the offline page as a fallback,
 *   - static build assets (icons, fonts, hashed JS/CSS) are cache-first, and
 *   - API routes (/api/*) are always bypassed, so auth and data stay fresh and no
 *     stale timesheet is ever served as if it were live.
 *
 * Two things worth knowing before changing this:
 *
 * The shell is re-cached on every successful navigation rather than precached at
 * install. That is what keeps it honest across a deploy: the cached HTML and the
 * /_astro/* chunks it references are fetched on the same visit, so they are always
 * a matched pair. Precaching a shell at install and letting the assets update
 * separately is how you end up serving markup that points at chunk names the cache
 * doesn't hold — a blank page that only clearing site data fixes.
 *
 * Serving /app from cache means the server-side session check in
 * src/pages/app/[...path].astro doesn't run. That is deliberate. Offline there is
 * no token to check and nothing to check it against; what renders is the user's
 * own timesheet, already on this device in IndexedDB, and every route that could
 * reach GitHub with it is a /api/* call that is never served from cache. Signing
 * out clears the cached repo contents — see `signOut` in src/ui/WebApp.tsx.
 */
const VERSION = "v2";
const STATIC_CACHE = `worklog-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
/** The one cache entry every /app route falls back to. Canonical on purpose:
 *  /app, /app/new and /app/task/<id> are all the same server-rendered shell, and
 *  the client router reads the real path off `location` once it boots. */
const SHELL_URL = "/app";

// Treat these as immutable, cache-first assets.
const STATIC_DESTINATIONS = new Set(["style", "script", "font", "image", "manifest"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("worklog-static-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Can this navigation response stand in for the app on a later cold start?
 *
 *  A redirect can't: /app redirects to / when the session cookie is missing, and
 *  replaying a redirected response for a navigation is a hard error in the
 *  browser, not a soft miss. Caching one would turn "signed out once" into "the
 *  app no longer opens offline". */
function isCacheableShell(response) {
  return (
    response &&
    response.ok &&
    !response.redirected &&
    (response.headers.get("content-type") || "").includes("text/html")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests on our own origin.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth traffic — it must always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    const isApp = url.pathname === "/app" || url.pathname.startsWith("/app/");
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isApp && isCacheableShell(response)) {
            const copy = response.clone();
            event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(SHELL_URL, copy)));
          }
          return response;
        })
        .catch(() =>
          // Offline: the app's own shell if this is the app, so it can boot from
          // what IndexedDB holds; the offline page for anything else, and for a
          // first-ever visit to /app that never got a shell cached.
          caches
            .match(isApp ? SHELL_URL : OFFLINE_URL, { ignoreSearch: true })
            .then((cached) => cached || caches.match(OFFLINE_URL, { ignoreSearch: true }))
            .then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Static assets: cache-first, then update the cache in the background.
  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
