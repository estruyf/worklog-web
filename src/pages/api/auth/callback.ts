// OAuth callback: exchange the `code` for an access token server-side (the client
// secret never leaves this endpoint), store it in an httpOnly cookie, and send the
// user to the app. State is verified against the cookie set in login.ts.

import type { APIRoute } from 'astro';
import { appOrigin, getEnv, OAUTH_STATE_COOKIE, setToken } from '../../../host/session';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = context.cookies.get(OAUTH_STATE_COOKIE)?.value;
  context.cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response('Invalid OAuth state.', { status: 400 });
  }

  const env = getEnv(context);
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${appOrigin(context)}/api/auth/callback`,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    return new Response(`OAuth exchange failed: ${data.error_description ?? data.error ?? 'unknown error'}`, { status: 400 });
  }

  setToken(context, data.access_token);
  return context.redirect('/app', 302);
};
