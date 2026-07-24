import type { APIRoute } from 'astro';
import { getToken } from '../../host/session';
import { getUser } from '../../host/github';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const token = getToken(context);
  if (!token) {
    return new Response(JSON.stringify({ authenticated: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const user = await getUser(token);
    return Response.json({ authenticated: true, user });
  } catch {
    return new Response(JSON.stringify({ authenticated: false }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
};
