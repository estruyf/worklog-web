/// <reference path="../.astro/types.d.ts" />

// `App.Locals` is no longer declared here: since @astrojs/cloudflare v14 the adapter
// injects its own (`.astro/integrations/_astrojs_cloudflare/cloudflare.d.ts`), and its
// `Runtime` is `{ cfContext }` rather than a generic over the bindings — the env shape
// moved to the `cloudflare:workers` module below, where src/server/session.ts reads it.
//
// Declared by hand instead of generating `worker-configuration.d.ts` with
// `wrangler types`: three vars stay honest more cheaply than a regenerated file, and
// nothing else in the app imports from the Workers runtime. Note that `tsconfig.json`
// inherits `skipLibCheck: true`, so a mistake in this file is invisible to
// `tsc --noEmit` — the build and a request are what prove it.
declare module 'cloudflare:workers' {
  export const env: {
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    APP_BASE_URL?: string;
  };
}

interface Window {
  /** Set by the service-worker registration in src/layouts/Layout.astro when a new
   *  build is waiting. A latch rather than only an event, because it can be set
   *  before the React island that renders the prompt has hydrated. */
  __worklogUpdateReady?: boolean;
}
