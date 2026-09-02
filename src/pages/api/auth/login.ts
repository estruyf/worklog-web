// Kick off the GitHub OAuth App code flow. Redirects to GitHub's authorize page
// with the `repo` scope (needed to read/write private timesheet repos) and a
// random state we stash in a short-lived cookie to check on callback. An
// already-signed-in visitor skips GitHub entirely and lands in the app.

import type { APIRoute } from 'astro';
import {
  appOrigin,
  getEnv,
  getToken,
  isSecureRequest,
  OAUTH_STATE_COOKIE,
} from '../../../server/session';

export const prerender = false;

export const GET: APIRoute = (context) => {
  // The landing page stays reachable while signed in, so its "Sign in" buttons
  // are a way back into the app rather than a second trip through GitHub.
  if (getToken(context)) {
    return context.redirect('/app', 302);
  }

  const env = getEnv();
  if (!env.GITHUB_CLIENT_ID) {
    return new Response('GITHUB_CLIENT_ID is not configured.', { status: 500 });
  }

  const state = crypto.randomUUID();
  context.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isSecureRequest(context),
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${appOrigin(context)}/api/auth/callback`,
    scope: 'repo read:user',
    state,
    allow_signup: 'false',
  });
  return context.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
};
