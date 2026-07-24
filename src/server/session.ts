// Cookie-backed session for the GitHub OAuth token. The token lives in an
// httpOnly, secure cookie so it never reaches client JS; every GitHub call is
// proxied through the api/* routes which read it here.

import type { APIContext } from 'astro';

export const TOKEN_COOKIE = 'wl_gh_token';
export const OAUTH_STATE_COOKIE = 'wl_oauth_state';

export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  /** Absolute base URL of the deployment, e.g. https://worklog.example.com */
  APP_BASE_URL?: string;
}

/** Read env from the Cloudflare runtime (prod / `wrangler`) or Vite (`import.meta.env`). */
export function getEnv(context: APIContext): Env {
  const runtimeEnv = (context.locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env;
  const source = runtimeEnv ?? (import.meta.env as unknown as Record<string, string>);
  return {
    GITHUB_CLIENT_ID: source.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: source.GITHUB_CLIENT_SECRET,
    APP_BASE_URL: source.APP_BASE_URL,
  };
}

export function getToken(context: APIContext): string | undefined {
  return context.cookies.get(TOKEN_COOKIE)?.value || undefined;
}

export function setToken(context: APIContext, token: string): void {
  context.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearToken(context: APIContext): void {
  context.cookies.delete(TOKEN_COOKIE, { path: '/' });
}

/** The app's own origin, from APP_BASE_URL if set, else the request URL. */
export function appOrigin(context: APIContext): string {
  const env = getEnv(context);
  if (env.APP_BASE_URL) {
    return env.APP_BASE_URL.replace(/\/$/, '');
  }
  return new URL(context.request.url).origin;
}
