// Load a repo's Worklog files server-side (token stays in the cookie) and return
// the raw file map + base commit sha. The client turns this into a FileMap,
// parses it, and renders — no GitHub token ever reaches the browser.

import type { APIRoute } from 'astro';
import { getToken } from '../../server/session';
import { loadRepo, GitHubError } from '../../server/github';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const token = getToken(context);
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  const url = new URL(context.request.url);
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const branch = url.searchParams.get('branch') ?? undefined;
  if (!owner || !repo) {
    return new Response('owner and repo are required', { status: 400 });
  }
  try {
    const loaded = await loadRepo(token, owner, repo, branch);
    return Response.json(loaded);
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return new Response(err instanceof Error ? err.message : 'Load failed', { status });
  }
};
