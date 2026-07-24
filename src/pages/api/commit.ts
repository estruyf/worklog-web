// Commit changed files back to the branch via the Git Data API (direct commit,
// no PR). The client posts the dirty files + the base commit sha it loaded from;
// a moved ref returns 409 so the client can reload and re-apply.

import type { APIRoute } from 'astro';
import { getToken } from '../../server/session';
import { commitFiles, GitHubError, type CommitFile } from '../../server/github';

export const prerender = false;

interface CommitBody {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha: string;
  message: string;
  files: CommitFile[];
}

export const POST: APIRoute = async (context) => {
  const token = getToken(context);
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  let body: CommitBody;
  try {
    body = (await context.request.json()) as CommitBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const { owner, repo, branch, baseCommitSha, message, files } = body;
  if (!owner || !repo || !branch || !baseCommitSha || !Array.isArray(files)) {
    return new Response('Missing commit fields', { status: 400 });
  }
  try {
    const result = await commitFiles(token, owner, repo, branch, baseCommitSha, files, message || 'chore: worklog sync');
    return Response.json(result);
  } catch (err) {
    if (err instanceof GitHubError && err.isConflict) {
      return new Response(JSON.stringify({ conflict: true, message: err.message }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(err instanceof Error ? err.message : 'Commit failed', { status: 500 });
  }
};
