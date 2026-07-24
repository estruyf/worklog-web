// Initialize a fresh Worklog project. Two modes:
//   - `create`   : make a brand-new GitHub repo (name + visibility), then scaffold.
//   - `existing` : scaffold into an existing (empty or non-Worklog) repo.
// The scaffold is intentionally minimal — a default `.worklog/config.json` plus
// empty clients/, worklog/ and archive/ folders (kept via .gitkeep). The client
// then opens the returned repo like any other.

import type { APIRoute } from 'astro';
import { getToken } from '../../server/session';
import { createRepo, scaffoldRepo, GitHubError, type CommitFile } from '../../server/github';
import { DEFAULT_STATUSES } from '../../model/status';
import { DEFAULT_AUTO_SYNC, DEFAULT_HOURS_PER_DAY, DEFAULT_WEEK_START } from '../../workspace/paths';
import type { DaylogConfig } from '../../model/types';

export const prerender = false;

interface CreateBody {
  mode: 'create';
  name: string;
  private?: boolean;
}
interface ExistingBody {
  mode: 'existing';
  owner: string;
  repo: string;
  branch?: string;
}
type InitBody = CreateBody | ExistingBody;

/** The files that make up an empty Worklog project. */
function scaffoldFiles(): CommitFile[] {
  const config: DaylogConfig = {
    hoursPerDay: DEFAULT_HOURS_PER_DAY,
    weekStart: DEFAULT_WEEK_START,
    clients: [],
    statuses: DEFAULT_STATUSES,
    autoSync: { ...DEFAULT_AUTO_SYNC },
  };
  return [
    { path: '.worklog/config.json', content: JSON.stringify(config, null, 2) + '\n' },
    { path: 'clients/.gitkeep', content: '' },
    { path: 'worklog/.gitkeep', content: '' },
    { path: 'archive/.gitkeep', content: '' },
  ];
}

export const POST: APIRoute = async (context) => {
  const token = getToken(context);
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: InitBody;
  try {
    body = (await context.request.json()) as InitBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  try {
    let owner: string;
    let repo: string;
    let branch: string | undefined;

    if (body.mode === 'create') {
      const name = (body.name ?? '').trim();
      if (!name) {
        return new Response('A repository name is required', { status: 400 });
      }
      const created = await createRepo(token, name, body.private !== false);
      owner = created.owner;
      repo = created.repo;
      branch = created.defaultBranch;
    } else if (body.mode === 'existing') {
      if (!body.owner || !body.repo) {
        return new Response('owner and repo are required', { status: 400 });
      }
      owner = body.owner;
      repo = body.repo;
      branch = body.branch;
    } else {
      return new Response('Unknown init mode', { status: 400 });
    }

    const result = await scaffoldRepo(token, owner, repo, branch, scaffoldFiles(), 'chore: initialize worklog project');
    return Response.json({ owner, repo, branch: result.branch });
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    return new Response(err instanceof Error ? err.message : 'Init failed', { status });
  }
};
