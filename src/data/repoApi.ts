// The three calls the data layer makes to the server, and the shapes they carry.
// Everything GitHub-facing goes through /api/* so the token stays server-side —
// nothing here knows about authentication, and nothing here touches app state.

/** Which branch of which repo is mounted, and the commit it was loaded at. */
export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha: string;
}

/** A branch's Worklog files as /api/load returns them. Text only — assets
 *  appear in `sha` but their bytes come through {@link fetchAsset} when an
 *  image is first rendered, so the first paint never waits on them. */
export interface LoadResponse {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha: string;
  text: Record<string, string>;
  sha: Record<string, string>;
}

/** One file in a commit payload: written (text or base64) or removed. Mirrors
 *  `CommitFile` on the server side of /api/commit. */
export interface OutgoingFile {
  path: string;
  content?: string;
  base64?: string;
  deleted?: boolean;
}

/** A commit either landed, or the branch moved under it and has to be merged
 *  against its new head first (the server's 409). */
export type CommitResult = { conflict: true } | { conflict: false; commitSha: string };

/** Fetch a branch's Worklog files from GitHub. */
export async function fetchRepo(owner: string, repo: string, branch?: string): Promise<LoadResponse> {
  const params = new URLSearchParams({ owner, repo });
  if (branch) {
    params.set('branch', branch);
  }
  const res = await fetch(`/api/load?${params}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as LoadResponse;
}

/** One asset's bytes, fetched on first render. Sha-addressed so the browser's
 *  HTTP cache can keep it across sessions — the same image never downloads
 *  twice while its blob is unchanged. */
export async function fetchAsset(repo: { owner: string; repo: string }, path: string, sha: string): Promise<Uint8Array> {
  const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo, path, sha });
  const res = await fetch(`/api/asset?${params}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** The branch's head commit on GitHub right now. Throws when the check fails —
 *  a sync that can't see the branch must not claim everything is up to date. */
export async function fetchHead(repo: RepoContext): Promise<string> {
  const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo, branch: repo.branch });
  const res = await fetch(`/api/head?${params}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return ((await res.json()) as { commitSha: string }).commitSha;
}

/** Commit `files` onto `repo.baseCommitSha`. Resolves to `{ conflict: true }`
 *  when the branch moved in the meantime; throws on any other failure. */
export async function commitFiles(repo: RepoContext, message: string, files: OutgoingFile[]): Promise<CommitResult> {
  const res = await fetch('/api/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...repo, message, files }),
  });
  if (res.status === 409) {
    return { conflict: true };
  }
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const result = (await res.json()) as { commitSha: string };
  return { conflict: false, commitSha: result.commitSha };
}
