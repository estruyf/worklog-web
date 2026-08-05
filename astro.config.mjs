// @ts-check
import { readFile, writeFile } from "node:fs/promises";
import { defineConfig, fontProviders } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// `public/sw.js` ships verbatim, so across deploys it is byte-identical — and a
// byte comparison is exactly how the browser decides whether a service worker has
// changed. New app code would go out with no `updatefound`, and an installed PWA
// that never navigates would never hear about it. Stamping a build id makes the
// file differ; nothing reads the value. Runs after the public/ copy, on the built
// output only, so the source file keeps its placeholder.
const stampServiceWorker = () => ({
  name: "stamp-service-worker",
  hooks: {
    "astro:build:done": async ({ dir, logger }) => {
      const sw = new URL("sw.js", dir);
      const src = await readFile(sw, "utf8");
      if (!src.includes("__BUILD_ID__")) {
        // Silence here would mean shipping a service worker that can never update.
        throw new Error("sw.js has no __BUILD_ID__ placeholder to stamp");
      }
      const id = `${Date.now().toString(36)}`;
      await writeFile(sw, src.replace("__BUILD_ID__", id));
      logger.info(`stamped sw.js with build ${id}`);
    },
  },
});

// Dev only: the React 19 client island needs the browser entry resolved. In Vite 6
// `resolve.conditions` also drives SSR resolution, so applying it during `build`
// would pull in `react-dom/server.browser` (which references `MessageChannel`,
// undefined in the Workers runtime) instead of the worker/edge build. Scope it to dev.
const isDev = process.argv.includes("dev");

// SSR on Cloudflare so the OAuth token-exchange endpoints (api/auth/*) can keep
// the GitHub client secret server-side. The dashboard itself is a React island.
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [react(), stampServiceWorker()],
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Inter",
        cssVariable: "--font-inter",
        weights: [400, 500, 600, 700],
        styles: ["normal"],
        fallbacks: ["-apple-system", "system-ui", "Segoe UI", "sans-serif"],
      },
      {
        provider: fontProviders.google(),
        name: "JetBrains Mono",
        cssVariable: "--font-jetbrains-mono",
        weights: [400, 500],
        styles: ["normal"],
        fallbacks: ["ui-monospace", "monospace"],
      },
    ],
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: isDev
      ? // Dev runs the SSR in Node, so the browser entry is fine there.
        { conditions: ["browser"] }
      : // Build for the Workers runtime: pin react-dom to its edge server build.
        // `react-dom/server` otherwise resolves to `server.browser`, which uses
        // `MessageChannel` (undefined in Workers). `server.edge` uses streaming APIs.
        { alias: { "react-dom/server": "react-dom/server.edge" } },
  },
});
