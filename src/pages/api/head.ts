// Report the branch's current head commit on GitHub. The client compares it with
// the commit it loaded from to find out whether the branch moved — i.e. whether a
// sync has to pull before (or after) it pushes.

import type { APIRoute } from 'astro';
import { getToken } from '../../server/session';
import { getBranchHead, GitHubError } from '../../server/github';

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
    return Response.json(await getBranchHead(token, owner, repo, branch));
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return new Response(err instanceof Error ? err.message : 'Head lookup failed', { status });
  }
};
