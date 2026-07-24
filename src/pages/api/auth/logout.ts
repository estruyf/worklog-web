import type { APIRoute } from 'astro';
import { clearToken } from '../../../server/session';

export const prerender = false;

export const POST: APIRoute = (context) => {
  clearToken(context);
  return new Response(null, { status: 204 });
};

export const GET: APIRoute = (context) => {
  clearToken(context);
  return context.redirect('/', 302);
};
