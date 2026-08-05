/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_BASE_URL?: string;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface Window {
  /** Set by the service-worker registration in src/layouts/Layout.astro when a new
   *  build is waiting. A latch rather than only an event, because it can be set
   *  before the React island that renders the prompt has hydrated. */
  __worklogUpdateReady?: boolean;
}
