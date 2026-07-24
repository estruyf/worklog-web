import type { APIRoute } from 'astro';
import { getToken } from '../../host/session';
import { listRepos } from '../../host/github';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const token = getToken(context);
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  const repos = await listRepos(token);
  return Response.json({ repos });
};
