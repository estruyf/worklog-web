// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

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
  integrations: [react()],
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
