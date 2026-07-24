// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

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
    resolve: {
      // Cloudflare + React 19: dev needs the non-SSR entry for the client island.
      conditions: ["browser"],
    },
  },
});
