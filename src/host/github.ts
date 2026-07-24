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
  /** Binary files (assets), base64-encoded, keyed by repo-relative path. */
  binary: Record<string, string>;
  /** Blob sha per path, so the client can skip re-committing unchanged files. */
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

/** Which repo-relative paths make up a Worklog project. */
function isWorklogPath(path: string): boolean {
  return (
    path === '.worklog/config.json' ||
    path === 'worklog.worklog' ||
    /^clients\/[^/]+\.md$/.test(path) ||
    /^archive\/[^/]+\/[^/]+\.md$/.test(path) ||
    /^worklog\/[^/]+\.md$/.test(path) ||
    /^assets\/[^/]+$/.test(path)
  );
}

const TEXT_PATH = /\.(md|json)$|\.worklog$/;

export async function loadRepo(token: string, owner: string, repo: string, branchArg?: string): Promise<LoadedRepo> {
  const branch = branchArg || (await gh<{ default_branch: string }>(token, `/repos/${owner}/${repo}`)).default_branch;
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const baseCommitSha = ref.object.sha;
  const commit = await gh<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
  const tree = await gh<{ tree: Array<{ path: string; type: string; sha: string }> }>(
    token,
    `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`,
  );

  const blobs = tree.tree.filter((e) => e.type === 'blob' && isWorklogPath(e.path));
  const text: Record<string, string> = {};
  const binary: Record<string, string> = {};
  const sha: Record<string, string> = {};

  await Promise.all(
    blobs.map(async (e) => {
      const blob = await gh<{ content: string; encoding: string }>(token, `/repos/${owner}/${repo}/git/blobs/${e.sha}`);
      sha[e.path] = e.sha;
      const raw = blob.encoding === 'base64' ? blob.content.replace(/\n/g, '') : blob.content;
      if (TEXT_PATH.test(e.path)) {
        text[e.path] = blob.encoding === 'base64' ? decodeBase64Utf8(raw) : raw;
      } else {
        binary[e.path] = raw; // keep base64 for assets
      }
    }),
  );

  return { owner, repo, branch, baseCommitSha, text, binary, sha };
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

/** Decode a base64 blob (GitHub returns base64 for file contents) as UTF-8 text. */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}
