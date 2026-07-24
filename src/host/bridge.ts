// In-process replacement for the extension's webview <-> host message bus.
//
// In the extension the webview posted messages over `postMessage` to the Node
// host, which mutated markdown on disk and pushed back a Snapshot. Here both ends
// live in the browser: `post()` calls the ported `handleWebviewMessage` directly
// against an in-memory file map, `store.rebuild()` re-parses it, and the fresh
// Snapshot is emitted straight back to the React app. Persistence is a debounced
// commit of the dirty files to GitHub (direct commit to the branch).

import { Store } from '../store';
import { FileMap, mountFileMap } from '../workspace/paths';
import { buildSnapshot } from '../views/snapshot';
import { handleWebviewMessage, type HandlerCtx } from '../views/webviewHandler';
import type { HostMessage, WebviewMessage } from '../webview/protocol';

const AUTO_COMMIT_DELAY_MS = 60_000;

interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha: string;
}

interface LoadResponse {
  owner: string;
  repo: string;
  branch: string;
  baseCommitSha: string;
  text: Record<string, string>;
  binary: Record<string, string>;
  sha: Record<string, string>;
}

type Listener = (message: HostMessage) => void;

class WorklogBridge {
  private store = new Store();
  private fm = new FileMap();
  private repo?: RepoContext;
  private listeners = new Set<Listener>();
  private loaded = false;
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  private committing = false;

  constructor() {
    // Every persisted edit re-derives the snapshot, marks the tree dirty, and
    // arms the debounced auto-commit — mirroring the extension's auto-sync.
    this.store.onDidChange(() => {
      this.emitSnapshot();
      this.emit({ type: 'gitStatus', pendingChanges: this.fm.dirty.size > 0 });
      this.scheduleCommit();
    });
  }

  // ---- webview-facing API (imported by webview/vscodeApi.ts) --------------

  post(message: WebviewMessage): void {
    if (message.type === 'ready') {
      this.emit({ type: 'loading', loading: !this.loaded });
      if (this.loaded) {
        this.emitSnapshot();
        this.emit({ type: 'gitStatus', pendingChanges: this.fm.dirty.size > 0 });
      }
      return;
    }
    void handleWebviewMessage(this.store, message, this.ctx());
  }

  onHostMessage(handler: Listener): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  // ---- app-shell API ------------------------------------------------------

  isLoaded(): boolean {
    return this.loaded;
  }

  currentRepo(): RepoContext | undefined {
    return this.repo;
  }

  hasPending(): boolean {
    return this.fm.dirty.size > 0;
  }

  /** Load a repo from GitHub and render it. */
  async open(owner: string, repo: string, branch?: string): Promise<void> {
    this.emit({ type: 'loading', loading: true });
    const params = new URLSearchParams({ owner, repo });
    if (branch) {
      params.set('branch', branch);
    }
    const res = await fetch(`/api/load?${params}`);
    if (!res.ok) {
      this.emit({ type: 'loading', loading: false });
      this.emit({ type: 'actionError', message: `Could not load ${owner}/${repo}: ${await res.text()}` });
      throw new Error('load failed');
    }
    const data = (await res.json()) as LoadResponse;
    this.applyLoad(data);
    await this.store.rebuild('open');
    this.loaded = true;
    this.emit({ type: 'loading', loading: false });
    this.emitSnapshot();
    this.emit({ type: 'gitStatus', pendingChanges: false });
  }

  /** Reload the current repo from GitHub, discarding uncommitted in-memory edits. */
  async reload(): Promise<void> {
    if (this.repo) {
      await this.open(this.repo.owner, this.repo.repo, this.repo.branch);
    }
  }

  /** Commit dirty files now (used by the Sync button and the debounce). */
  async commitNow(): Promise<void> {
    if (!this.repo || this.committing || this.fm.dirty.size === 0) {
      return;
    }
    this.clearCommitTimer();
    this.committing = true;
    this.emit({ type: 'loading', loading: true });
    try {
      const files = [...this.fm.dirty].map((path) => {
        if (this.fm.binary.has(path)) {
          return { path, base64: bytesToBase64(this.fm.binary.get(path)!) };
        }
        return { path, content: this.fm.text.get(path) ?? '' };
      });
      const message = `chore: worklog sync ${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.repo, message, files }),
      });
      if (res.status === 409) {
        // Branch moved: refresh the base sha and retry once on the next tick.
        await this.refreshBaseSha();
        this.committing = false;
        this.scheduleCommit(0);
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = (await res.json()) as { commitSha: string };
      this.repo.baseCommitSha = result.commitSha;
      this.fm.clearDirty();
      this.emit({ type: 'gitStatus', pendingChanges: false });
      this.emit({ type: 'actionDone', message: 'Synced to GitHub.' });
    } catch (err) {
      this.emit({ type: 'actionError', message: `Sync failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      this.committing = false;
      this.emit({ type: 'loading', loading: false });
    }
  }

  // ---- internals ----------------------------------------------------------

  private applyLoad(data: LoadResponse): void {
    this.fm = new FileMap();
    for (const [path, text] of Object.entries(data.text)) {
      this.fm.text.set(path, text);
    }
    for (const [path, base64] of Object.entries(data.binary)) {
      this.fm.binary.set(path, base64ToBytes(base64));
    }
    for (const [path, sha] of Object.entries(data.sha)) {
      this.fm.baseSha.set(path, sha);
    }
    mountFileMap(this.fm);
    this.repo = { owner: data.owner, repo: data.repo, branch: data.branch, baseCommitSha: data.baseCommitSha };
  }

  private async refreshBaseSha(): Promise<void> {
    if (!this.repo) {
      return;
    }
    const params = new URLSearchParams({ owner: this.repo.owner, repo: this.repo.repo, branch: this.repo.branch });
    const res = await fetch(`/api/load?${params}`);
    if (res.ok) {
      const data = (await res.json()) as LoadResponse;
      this.repo.baseCommitSha = data.baseCommitSha;
    }
  }

  private ctx(): HandlerCtx {
    return {
      post: (m) => this.emit(m),
      openExternal: (url) => {
        const abs = url.startsWith('http') ? url : new URL(url, window.location.href).href;
        window.open(abs, '_blank', 'noopener');
      },
      sourceUrl: (taskId) => {
        const task = this.store.db.getTask(taskId);
        if (!task || !this.repo) {
          return undefined;
        }
        const { owner, repo, branch } = this.repo;
        return `https://github.com/${owner}/${repo}/blob/${branch}/${task.sourceFile}#L${task.sourceLine + 1}`;
      },
      triggerSync: () => void this.commitNow(),
      reload: () => void this.reload(),
    };
  }

  private emitSnapshot(): void {
    if (!this.repo) {
      return;
    }
    const assetsBase = `https://raw.githubusercontent.com/${this.repo.owner}/${this.repo.repo}/${this.repo.branch}/`;
    this.emit({ type: 'snapshot', snapshot: buildSnapshot(this.store, assetsBase) });
  }

  private emit(message: HostMessage): void {
    for (const l of this.listeners) {
      l(message);
    }
  }

  private scheduleCommit(delay = AUTO_COMMIT_DELAY_MS): void {
    if (this.committing) {
      return;
    }
    this.clearCommitTimer();
    this.commitTimer = setTimeout(() => void this.commitNow(), delay);
  }

  private clearCommitTimer(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = undefined;
    }
  }
}

// Singleton — the whole app shares one bridge (one repo mounted at a time).
export const bridge = new WorklogBridge();

// The webview imports these two; keep the exact signatures of the VS Code shim.
export function post(message: WebviewMessage): void {
  bridge.post(message);
}
export function onHostMessage(handler: Listener): () => void {
  return bridge.onHostMessage(handler);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
