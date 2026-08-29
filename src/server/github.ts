// Server-side GitHub REST client. Runs only inside the Astro API routes, where
// the OAuth token (kept in an httpOnly cookie) is available — the browser never
// sees the token or calls api.github.com directly. Covers: identity, repo list,
// loading the Worklog files for a repo, and committing changed files back via the
// Git Data API (blobs -> tree -> commit -> update ref) = "direct commit to branch".

const API = 'https://api.github.com';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  pushedAt: string | null;
}

export interface LoadedRepo {
  owner: string;
  repo: string;
  branch: string;
  /** commit sha the working set is based on (parent of the next commit). */
  baseCommitSha: string;
  /** UTF-8 text files (markdown / json), keyed by repo-relative path. */
  text: Record<string, string>;
  /** Blob sha per path — every Worklog path on the branch, assets included.
   *  Assets travel as paths + shas only; their bytes come through /api/asset
   *  when the UI actually renders one (see {@link loadAssetBlob}). */
  sha: Record<string, string>;
}

/** A file to write in a commit. `deleted` drops it from the tree. */
export interface CommitFile {
  path: string;
  /** UTF-8 text content (omit when deleted or when `base64` is set). */
  content?: string;
  /** base64 content for binary files (assets). */
  base64?: string;
  deleted?: boolean;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isConflict = false,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'worklog-web',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const conflict = res.status === 409 || res.status === 422;
    throw new GitHubError(`GitHub ${init?.method ?? 'GET'} ${path} → ${res.status}: ${body.slice(0, 300)}`, res.status, conflict);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function getUser(token: string): Promise<GitHubUser> {
  const u = await gh<{ login: string; name: string | null; avatar_url: string }>(token, '/user');
  return { login: u.login, name: u.name, avatarUrl: u.avatar_url };
}

export async function listRepos(token: string): Promise<RepoSummary[]> {
  const repos: RepoSummary[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await gh<
      Array<{ full_name: string; owner: { login: string }; name: string; private: boolean; default_branch: string; pushed_at: string | null }>
    >(token, `/user/repos?per_page=100&sort=pushed&page=${page}`);
    for (const r of batch) {
      repos.push({
        fullName: r.full_name,
        owner: r.owner.login,
        name: r.name,
        private: r.private,
        defaultBranch: r.default_branch,
        pushedAt: r.pushed_at,
      });
    }
    if (batch.length < 100) {
      break;
    }
  }
  return repos;
}

/** A commit payload named a path outside the Worklog layout. Its own type so the
 *  route can answer 400 (the client sent something it should never send) rather
 *  than 500 (GitHub said no). */
export class UnsafePathError extends Error {
  constructor(readonly paths: string[]) {
    super(`Refusing to commit path(s) outside the Worklog layout: ${paths.join(', ')}`);
    this.name = 'UnsafePathError';
  }
}

/** Which repo-relative paths make up a Worklog project. Gates both directions:
 *  which blobs {@link loadRepo} reads, and which paths {@link commitFiles} is
 *  willing to write. */
export function isWorklogPath(path: string): boolean {
  return (
    path === '.worklog/config.json' ||
    path === 'worklog.worklog' ||
    /^clients\/[^/]+\.md$/.test(path) ||
    /^archive\/[^/]+\/[^/]+\.md$/.test(path) ||
    /^worklog\/[^/]+\.md$/.test(path) ||
    /^notes\/[^/]+\.md$/.test(path) ||
    /^lists\/[^/]+\.md$/.test(path) ||
    /^assets\/[^/]+$/.test(path)
  );
}

const TEXT_PATH = /\.(md|json)$|\.worklog$/;

export interface BranchHead {
  branch: string;
  /** Commit the branch currently points at on GitHub. */
  commitSha: string;
}

/** The branch's current head commit. One ref lookup, no tree or blobs — cheap
 *  enough for the client to ask on every sync to spot new commits pushed
 *  elsewhere. */
export async function getBranchHead(token: string, owner: string, repo: string, branchArg?: string): Promise<BranchHead> {
  const branch = branchArg || (await gh<{ default_branch: string }>(token, `/repos/${owner}/${repo}`)).default_branch;
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  return { branch, commitSha: ref.object.sha };
}

export async function loadRepo(token: string, owner: string, repo: string, branchArg?: string): Promise<LoadedRepo> {
  const { branch, commitSha: baseCommitSha } = await getBranchHead(token, owner, repo, branchArg);
  const commit = await gh<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
  const tree = await gh<{ tree: Array<{ path: string; type: string; sha: string }> }>(
    token,
    `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`,
  );

  const blobs = tree.tree.filter((e) => e.type === 'blob' && isWorklogPath(e.path));
  const text: Record<string, string> = {};
  const sha: Record<string, string> = {};
  for (const e of blobs) {
    sha[e.path] = e.sha;
  }

  // Only the text files are fetched eagerly. Assets are most of a repo's bytes
  // and none of its meaning; shipping them here made the first load wait on
  // every screenshot ever pasted. The client fetches them by sha on first
  // render instead.
  await Promise.all(
    blobs
      .filter((e) => TEXT_PATH.test(e.path))
      .map(async (e) => {
        const blob = await gh<{ content: string; encoding: string }>(token, `/repos/${owner}/${repo}/git/blobs/${e.sha}`);
        const raw = blob.encoding === 'base64' ? blob.content.replace(/\n/g, '') : blob.content;
        text[e.path] = blob.encoding === 'base64' ? decodeBase64Utf8(raw) : raw;
      }),
  );

  return { owner, repo, branch, baseCommitSha, text, sha };
}

/** Raw bytes of one blob, for /api/asset. Sha-addressed rather than
 *  path-addressed so the response is immutable and the browser can cache it
 *  forever; the route layout-gates the accompanying path. */
export async function loadAssetBlob(token: string, owner: string, repo: string, blobSha: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/git/blobs/${blobSha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'worklog-web',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GitHubError(`GitHub GET blob ${blobSha} → ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  return res.arrayBuffer();
}

export interface CommitResult {
  commitSha: string;
  branch: string;
}

/** Commit a set of changed files onto `branch` on top of `baseCommitSha`. */
export async function commitFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  baseCommitSha: string,
  files: CommitFile[],
  message: string,
): Promise<CommitResult> {
  if (files.length === 0) {
    return { commitSha: baseCommitSha, branch };
  }

  // The token carries the `repo` scope, so this endpoint can reach every repository
  // the user owns — which makes the path list the only thing standing between a
  // compromised client and a `.github/workflows/*.yml` write (code execution in
  // their CI). `loadRepo` already refuses to read anything outside the layout;
  // writing has to be at least as narrow.
  const foreign = files.filter((f) => !isWorklogPath(f.path));
  if (foreign.length > 0) {
    throw new UnsafePathError(foreign.map((f) => f.path));
  }

  // Guard against a moved ref (someone/something else pushed): if the branch head
  // no longer equals baseCommitSha, the client must reload and re-apply.
  const head = await gh<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  if (head.object.sha !== baseCommitSha) {
    throw new GitHubError(`Branch ${branch} moved (expected ${baseCommitSha}, found ${head.object.sha}).`, 409, true);
  }
  const baseCommit = await gh<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);

  const treeEntries = await Promise.all(
    files.map(async (f) => {
      if (f.deleted) {
        return { path: f.path, mode: '100644', type: 'blob', sha: null };
      }
      const blob = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify(
          f.base64 !== undefined ? { content: f.base64, encoding: 'base64' } : { content: f.content ?? '', encoding: 'utf-8' },
        ),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  const newTree = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
  });

  const newCommit = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });

  await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });

  return { commitSha: newCommit.sha, branch };
}

export interface CreatedRepo {
  owner: string;
  repo: string;
  defaultBranch: string;
}

/** Create a new (empty, un-initialized) repository for the authenticated user.
 *  No `auto_init`, so the repo starts with no commits — {@link scaffoldRepo}
 *  then lays down the initial commit with the Worklog files. */
export async function createRepo(token: string, name: string, isPrivate: boolean): Promise<CreatedRepo> {
  const r = await gh<{ owner: { login: string }; name: string; default_branch: string }>(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name, private: isPrivate, auto_init: false }),
  });
  return { owner: r.owner.login, repo: r.name, defaultBranch: r.default_branch || 'main' };
}

/** Does the repo have any commits at all? A brand-new repo created without
 *  `auto_init` has none, and GitHub answers 409 ("Git Repository is empty.") on
 *  every Git Data endpoint until it does. */
async function repoHasCommits(token: string, owner: string, repo: string): Promise<boolean> {
  try {
    await gh<unknown[]>(token, `/repos/${owner}/${repo}/commits?per_page=1`);
    return true;
  } catch (err) {
    if (err instanceof GitHubError && (err.status === 404 || err.status === 409)) {
      return false;
    }
    throw err;
  }
}

/** The Git Data API (blobs/trees/commits) refuses to touch a repo with no commits,
 *  but the Contents API can write to one — so lay down a throwaway file with it to
 *  get the repo out of the "empty" state. The caller force-replaces this commit with
 *  a real root commit, so neither the placeholder nor this commit survives. */
async function bootstrapEmptyRepo(token: string, owner: string, repo: string): Promise<void> {
  await gh(token, `/repos/${owner}/${repo}/contents/.worklog-init`, {
    method: 'PUT',
    body: JSON.stringify({ message: 'chore: initialize repository', content: btoa('init') }),
  });
}

/** Commit the given files as the first (or next) commit on `branch`, creating the
 *  branch ref when the repo has no commits yet. Handles both a freshly created
 *  empty repo and an existing repo that already has history. Scaffolding never
 *  overwrites: files that already exist on the branch are left untouched. */
export async function scaffoldRepo(
  token: string,
  owner: string,
  repo: string,
  branchArg: string | undefined,
  files: CommitFile[],
  message: string,
): Promise<CommitResult> {
  const repoInfo = await gh<{ default_branch: string }>(token, `/repos/${owner}/${repo}`);
  const defaultBranch = repoInfo.default_branch || 'main';
  const branch = branchArg || defaultBranch;

  // An empty repo has no ref yet (404/409), so there is no parent commit or base tree.
  let baseCommitSha: string | undefined;
  let baseTreeSha: string | undefined;
  let isEmptyRepo = false;
  let existingPaths = new Set<string>();
  try {
    const ref = await gh<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    baseCommitSha = ref.object.sha;
    const baseCommit = await gh<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
    baseTreeSha = baseCommit.tree.sha;
    const baseTree = await gh<{ tree: Array<{ path: string; type: string }> }>(
      token,
      `/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`,
    );
    existingPaths = new Set(baseTree.tree.filter((e) => e.type === 'blob').map((e) => e.path));
  } catch (err) {
    // 404 (no such ref) / 409 (empty repository) both mean "no history on this branch",
    // but only a repo with zero commits needs the Contents API bootstrap below.
    if (!(err instanceof GitHubError && (err.status === 404 || err.status === 409))) {
      throw err;
    }
    isEmptyRepo = !(await repoHasCommits(token, owner, repo));
    if (isEmptyRepo) {
      // Creates the default branch; we rewrite it to our own root commit further down.
      await bootstrapEmptyRepo(token, owner, repo);
    }
  }

  // Anything the repo already has (a README, a config from a previous init) wins.
  const missing = files.filter((f) => !existingPaths.has(f.path));
  if (missing.length === 0 && baseCommitSha) {
    return { commitSha: baseCommitSha, branch };
  }

  const treeEntries = await Promise.all(
    missing.map(async (f) => {
      const blob = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify(
          f.base64 !== undefined ? { content: f.base64, encoding: 'base64' } : { content: f.content ?? '', encoding: 'utf-8' },
        ),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  const newTree = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ ...(baseTreeSha ? { base_tree: baseTreeSha } : {}), tree: treeEntries }),
  });

  const newCommit = await gh<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: baseCommitSha ? [baseCommitSha] : [] }),
  });

  if (baseCommitSha) {
    await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha, force: false }),
    });
  } else {
    if (isEmptyRepo) {
      // Discard the bootstrap commit: the default branch ends up with our parentless
      // commit as its only history, and `.worklog-init` never existed on it.
      await gh(token, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(defaultBranch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommit.sha, force: true }),
      });
    }
    if (!isEmptyRepo || branch !== defaultBranch) {
      await gh(token, `/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommit.sha }),
      });
    }
  }

  return { commitSha: newCommit.sha, branch };
}

/** Decode a base64 blob (GitHub returns base64 for file contents) as UTF-8 text. */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}
