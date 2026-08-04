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

/** Whether cookies for this request may carry `Secure`.
 *
 *  A `Secure` cookie sent over http is dropped by the browser, not downgraded —
 *  and Safari applies that to `http://localhost` too, where Chrome and Firefox
 *  make an exception. Setting it unconditionally makes the whole OAuth flow fail
 *  in dev with "Invalid OAuth state", because the state cookie never gets stored.
 *  In production the Worker sees the real https URL, so this stays on. */
export function isSecureRequest(context: APIContext): boolean {
  return new URL(context.request.url).protocol === 'https:';
}

export function getToken(context: APIContext): string | undefined {
  return context.cookies.get(TOKEN_COOKIE)?.value || undefined;
}

export function setToken(context: APIContext, token: string): void {
  context.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isSecureRequest(context),
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
