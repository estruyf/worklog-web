/* Worklog service worker.
 * The app is server-rendered on Cloudflare and its data comes from live GitHub
 * requests, so we don't attempt full offline functionality. Instead we:
 *   - precache a small offline fallback page,
 *   - serve static build assets (icons, fonts, hashed JS/CSS) cache-first, and
 *   - serve navigations network-first, falling back to the offline page.
 * API routes (/api/*) are always bypassed so auth and data stay fresh.
 */
const VERSION = "v1";
const STATIC_CACHE = `worklog-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

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

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests on our own origin.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth traffic — it must always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first with an offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL, { ignoreSearch: true }).then(
          (cached) => cached || Response.error()
        )
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
