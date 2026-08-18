// Serve one asset's bytes on demand. /api/load ships asset paths + shas only;
// the client calls this when the markdown renderer actually shows an image.
//
// The fetch is by blob sha, so the URL names immutable content and the browser
// may cache it for as long as it likes — a repeat open renders images without
// touching GitHub at all. The path is still required and layout-gated for
// consistency with the read side of `isWorklogPath`; the real access boundary
// is the session token, which GitHub scopes to the user's own repos (the same
// boundary /api/load relies on).

import type { APIRoute } from 'astro';
import { getToken } from '../../server/session';
import { loadAssetBlob, isWorklogPath, GitHubError } from '../../server/github';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const token = getToken(context);
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = new URL(context.request.url);
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const path = url.searchParams.get('path');
  const sha = url.searchParams.get('sha');
  if (!owner || !repo || !path || !sha) {
    return new Response('owner, repo, path and sha are required', { status: 400 });
  }
  if (!path.startsWith('assets/') || !isWorklogPath(path) || !/^[0-9a-f]{40}$/.test(sha)) {
    return new Response('not a Worklog asset', { status: 400 });
  }
  try {
    const bytes = await loadAssetBlob(token, owner, repo, sha);
    return new Response(bytes, {
      headers: {
        // The mime type is set client-side when the object URL is built (see
        // data/assetUrls); this response is only ever read via fetch().
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return new Response(err instanceof Error ? err.message : 'Asset load failed', { status });
  }
};
