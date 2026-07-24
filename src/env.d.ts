/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_BASE_URL?: string;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}
