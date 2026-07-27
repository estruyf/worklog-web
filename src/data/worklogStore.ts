// The app's data layer. It loads a Worklog repo from GitHub into an in-memory
// file map, parses it with the domain `Store`, and exposes:
//   - a reactive `{ data, loading, gitPending }` snapshot the UI subscribes to
//     via `useSyncExternalStore` (see ui/hooks/useWorklogState), and
//   - direct async action methods (createTask, setWorklog, saveImage, …) the UI
//     calls straight — no message bus.
// Every persisted edit re-derives the state, marks the tree dirty, and arms a
// debounced auto-commit that pushes the dirty files back to the branch.

import { Store } from '../store';
import { FileMap, mountFileMap } from '../workspace/paths';
import { today } from '../util/date';
import { createClient, createTask, updateClient } from '../services/tasks';
import { saveImageAsset } from '../services/assets';
import { isGeneralTodoClientId } from '../model/todos';
import {
  addTaskNote,
  closeTaskById,
  deleteTaskCascade,
  deleteTaskNote,
  setTaskCompletedDate,
  setTaskStatus,
  toggleTaskWorkedOn,
  updateTask,
  type TaskFields,
} from '../services/taskOps';
import { removeWorklog, setEventWorklog, setWorklog } from '../services/worklog';
import { updateSettings, type SettingsFields } from '../services/settings';
import type { WorklogState } from '../ui/state';
import { DEFAULT_AUTO_SYNC } from '../workspace/paths';
import { clearPending, loadPending, repoKeyOf, savePending, type PendingSnapshot } from './pendingStore';

/** Summary of recoverable unsynced changes found on open, for the UI prompt. */
export interface RecoveryInfo {
  /** Epoch millis the changes were last saved locally. */
  savedAt: number;
  /** Number of files with unsynced changes. */
  fileCount: number;
  /** True when the branch moved on GitHub since the changes were saved. */
  baseChanged: boolean;
}

export interface WorklogSnapshot {
  data: WorklogState | null;
  loading: boolean;
  gitPending: boolean;
}

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

export type ToastTone = 'loading' | 'success' | 'info' | 'error';

export interface ToastMessage {
  message: string;
  tone: ToastTone;
}

type Subscriber = () => void;
type ToastListener = (toast: ToastMessage | null) => void;

class WorklogStore {
  private store = new Store();
  private fm = new FileMap();
  private repo?: RepoContext;
  private loaded = false;
  private committing = false;
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  // A recovered snapshot loaded on open, held until the user restores or discards it.
  private recovered?: PendingSnapshot;

  private subscribers = new Set<Subscriber>();
  private toastListeners = new Set<ToastListener>();
  // Cached immutable snapshot: `getSnapshot` must return a stable reference between
  // changes so `useSyncExternalStore` doesn't loop. Rebuilt only on transitions.
  private snapshot: WorklogSnapshot = { data: null, loading: false, gitPending: false };

  constructor() {
    // Every persisted edit re-derives the state, flags the tree dirty, and arms
    // the debounced auto-commit.
    this.store.onDidChange(() => {
      this.updateSnapshot({ data: this.deriveState(), gitPending: this.fm.dirty.size > 0 });
      this.scheduleCommit();
      this.schedulePersist();
    });
  }

  // ---- reactive subscription (consumed by ui/hooks/useWorklogState) ---------

  subscribe = (listener: Subscriber): (() => void) => {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  };

  getSnapshot = (): WorklogSnapshot => this.snapshot;

  /** Subscribe to transient toast notifications: sync status and action failures.
   *  The listener receives `null` to dismiss. Returns an unsubscribe. */
  onToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  // ---- app-shell API --------------------------------------------------------

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
    this.updateSnapshot({ loading: true });
    const params = new URLSearchParams({ owner, repo });
    if (branch) {
      params.set('branch', branch);
    }
    const res = await fetch(`/api/load?${params}`);
    if (!res.ok) {
      this.updateSnapshot({ loading: false });
      this.emitToast(`Could not load ${owner}/${repo}: ${await res.text()}`, 'error');
      throw new Error('load failed');
    }
    const data = (await res.json()) as LoadResponse;
    this.applyLoad(data);
    await this.store.rebuild('open');
    this.loaded = true;
    this.updateSnapshot({ data: this.deriveState(), loading: false, gitPending: false });
    await this.loadRecovery();
  }

  /** Look for a locally-saved snapshot of unsynced edits for the freshly-opened
   *  repo. Held (not applied) so the UI can offer Restore or Discard. */
  private async loadRecovery(): Promise<void> {
    this.recovered = undefined;
    if (!this.repo) {
      return;
    }
    const saved = await loadPending(this.repoKey());
    if (saved && saved.dirty.length > 0) {
      this.recovered = saved;
    }
  }

  /** Summary of recoverable unsynced changes, or `null` if there are none. */
  getRecovery(): RecoveryInfo | null {
    if (!this.recovered || !this.repo) {
      return null;
    }
    return {
      savedAt: this.recovered.savedAt,
      fileCount: this.recovered.dirty.length,
      baseChanged: this.recovered.baseCommitSha !== this.repo.baseCommitSha,
    };
  }

  /** Re-apply the recovered snapshot's dirty files over the loaded repo and mark
   *  them for the next sync. Rebuilds the domain model from the merged tree. */
  async restorePending(): Promise<void> {
    const saved = this.recovered;
    if (!saved) {
      return;
    }
    this.recovered = undefined;
    for (const path of saved.dirty) {
      if (Object.prototype.hasOwnProperty.call(saved.binary, path)) {
        this.fm.binary.set(path, base64ToBytes(saved.binary[path]));
      } else {
        this.fm.text.set(path, saved.text[path] ?? '');
      }
      this.fm.markDirty(path);
    }
    // Re-parse the merged file map; onDidChange refreshes the snapshot, re-persists
    // and arms auto-sync.
    await this.store.rebuild('restore');
  }

  /** Drop the recovered snapshot without applying it, and delete it from storage. */
  async discardPending(): Promise<void> {
    this.recovered = undefined;
    if (this.repo) {
      await clearPending(this.repoKey());
    }
  }

  /** Reload the current repo from GitHub, discarding uncommitted in-memory edits. */
  async reload(): Promise<void> {
    if (this.repo) {
      await this.open(this.repo.owner, this.repo.repo, this.repo.branch);
    }
  }

  /** Commit dirty files now. Used by the Sync button and the background debounce.
   *  Both report progress ("Syncing changes…" → "Changes synced") and failures;
   *  `silent` only suppresses the no-op "Everything is up to date" notice, which
   *  a background sync has no reason to announce. */
  async sync(options: { silent?: boolean } = {}): Promise<void> {
    const { silent = false } = options;
    if (!this.repo || this.committing) {
      return;
    }
    if (this.fm.dirty.size === 0) {
      if (!silent) {
        this.emitToast('Everything is up to date', 'info');
      }
      return;
    }
    this.clearCommitTimer();
    this.committing = true;
    this.updateSnapshot({ loading: true });
    this.emitToast('Syncing changes…', 'loading');
    try {
      const files = [...this.fm.dirty].map((path) => {
        if (this.fm.binary.has(path)) {
          return { path, base64: bytesToBase64(this.fm.binary.get(path)!) };
        }
        return { path, content: this.fm.text.get(path) ?? '' };
      });
      const message = `chore: worklog sync ${today()}`;
      const res = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.repo, message, files }),
      });
      if (res.status === 409) {
        // Branch moved: refresh the base sha and retry once on the next tick. This
        // is a retry of an in-flight sync (manual or auto), so it runs regardless
        // of the auto-sync setting.
        await this.refreshBaseSha();
        this.committing = false;
        this.clearCommitTimer();
        this.commitTimer = setTimeout(() => void this.sync({ silent }), 0);
        return;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = (await res.json()) as { commitSha: string };
      this.repo.baseCommitSha = result.commitSha;
      this.fm.clearDirty();
      this.clearPersistTimer();
      void clearPending(this.repoKey());
      this.updateSnapshot({ gitPending: false });
      this.emitToast('Changes synced', 'success');
    } catch (err) {
      // Failures surface even for background syncs.
      this.emitToast(`Sync failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      this.committing = false;
      this.updateSnapshot({ loading: false });
    }
  }

  // ---- actions (call the domain services directly) --------------------------

  createTask(input: {
    title: string;
    clientId: string;
    parentId?: string;
    links?: string[];
    description?: string;
    due?: string;
    tags?: string[];
  }): Promise<void> {
    return this.run(() => createTask(this.store, input));
  }

  updateTask(taskId: string, fields: TaskFields): Promise<void> {
    return this.run(() => updateTask(this.store, taskId, fields));
  }

  createClient(name: string, color?: string): Promise<void> {
    return this.run(() => createClient(this.store, { name, color }));
  }

  updateClient(id: string, fields: { name?: string; color?: string }): Promise<void> {
    return this.run(() => updateClient(this.store, id, fields));
  }

  updateSettings(fields: SettingsFields): Promise<void> {
    return this.run(() => updateSettings(this.store, fields));
  }

  closeTask(taskId: string, date?: string): Promise<void> {
    return this.run(() => closeTaskById(this.store, taskId, date));
  }

  setCompletedDate(taskId: string, date: string): Promise<void> {
    return this.run(() => setTaskCompletedDate(this.store, taskId, date));
  }

  toggleWorked(taskId: string, date: string): Promise<void> {
    return this.run(() => toggleTaskWorkedOn(this.store, taskId, date));
  }

  setStatus(taskId: string, statusId: string): Promise<void> {
    return this.run(() => setTaskStatus(this.store, taskId, statusId));
  }

  deleteTask(taskId: string): Promise<void> {
    return this.run(() => deleteTaskCascade(this.store, taskId));
  }

  addNote(taskId: string, text: string): Promise<void> {
    return this.run(() => addTaskNote(this.store, taskId, text));
  }

  deleteNote(taskId: string, index: number): Promise<void> {
    return this.run(() => deleteTaskNote(this.store, taskId, index));
  }

  setWorklog(date: string, clientId: string, hours: number, note?: string): Promise<void> {
    return this.run(() => setWorklog(this.store, date, clientId, hours, note));
  }

  setEventWorklog(date: string, eventType: string, hours: number, note?: string): Promise<void> {
    return this.run(() => setEventWorklog(this.store, date, eventType, hours, note));
  }

  removeWorklog(date: string, clientId: string): Promise<void> {
    return this.run(() => removeWorklog(this.store, date, clientId));
  }

  /** Save a pasted/dropped/picked image and return the markdown ref to insert. */
  async saveImage(dataBase64: string, ext: string): Promise<string> {
    const ref = await saveImageAsset(this.store, dataBase64, ext);
    // Image bytes are written straight to the file map (no store rebuild), so mirror
    // them for recovery here too — the referencing edit will follow and re-persist.
    this.schedulePersist();
    return ref;
  }

  // ---- internals ------------------------------------------------------------

  /** Run a mutating action, surfacing any failure as a toast. */
  private async run(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (err) {
      this.emitToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  private deriveState(): WorklogState {
    const config = this.store.getConfig();
    const assetsBase = this.repo
      ? `https://raw.githubusercontent.com/${this.repo.owner}/${this.repo.repo}/${this.repo.branch}/`
      : '';
    return {
      today: today(),
      hoursPerDay: config.hoursPerDay,
      weekStart: config.weekStart,
      autoSync: config.autoSync,
      assetsBase,
      statuses: config.statuses,
      // The general to-do bucket is a task-only concept; keep it out of the
      // client list so it never surfaces in billing (log form, dashboard, totals).
      clients: this.store.db.getClients().filter((c) => !isGeneralTodoClientId(c.id)),
      tasks: this.store.db.getAllTasks(),
      worklog: this.store.db.getAllWorklog(),
    };
  }

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

  /** Merge a partial into the cached snapshot (new reference) and notify. */
  private updateSnapshot(patch: Partial<WorklogSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.subscribers) {
      l();
    }
  }

  private emitToast(message: string, tone: ToastTone): void {
    const toast: ToastMessage = { message, tone };
    for (const l of this.toastListeners) {
      l(toast);
    }
  }

  /** Arm the debounced auto-commit, but only when auto-sync is enabled in config.
   *  The delay comes from `autoSync.delayMinutes`; a burst of edits coalesces into
   *  a single sync. Manual "Git sync" and 409 retries bypass this. */
  private scheduleCommit(): void {
    const autoSync = this.store.getConfig()?.autoSync ?? DEFAULT_AUTO_SYNC;
    if (!autoSync.enabled || this.committing) {
      return;
    }
    this.clearCommitTimer();
    const delay = Math.max(1, autoSync.delayMinutes) * 60_000;
    this.commitTimer = setTimeout(() => void this.sync({ silent: true }), delay);
  }

  private clearCommitTimer(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = undefined;
    }
  }

  private repoKey(): string {
    if (!this.repo) {
      return '';
    }
    return repoKeyOf(this.repo.owner, this.repo.repo, this.repo.branch);
  }

  /** Debounce a write of the dirty files to IndexedDB so a burst of edits
   *  coalesces into a single mirror. Runs regardless of the auto-sync setting —
   *  this is crash/close recovery, not a commit. */
  private schedulePersist(): void {
    this.clearPersistTimer();
    this.persistTimer = setTimeout(() => void this.persistNow(), 800);
  }

  private clearPersistTimer(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }
  }

  /** Mirror the current dirty files to IndexedDB. A no-op when nothing is dirty —
   *  clearing the store happens only on a successful sync or an explicit discard,
   *  so a freshly-loaded (clean) repo never wipes a recoverable snapshot. */
  private async persistNow(): Promise<void> {
    this.clearPersistTimer();
    if (!this.repo || this.fm.dirty.size === 0) {
      return;
    }
    const text: Record<string, string> = {};
    const binary: Record<string, string> = {};
    for (const path of this.fm.dirty) {
      if (this.fm.binary.has(path)) {
        binary[path] = bytesToBase64(this.fm.binary.get(path)!);
      } else {
        text[path] = this.fm.text.get(path) ?? '';
      }
    }
    const snapshot: PendingSnapshot = {
      repoKey: this.repoKey(),
      owner: this.repo.owner,
      repo: this.repo.repo,
      branch: this.repo.branch,
      baseCommitSha: this.repo.baseCommitSha,
      savedAt: Date.now(),
      text,
      binary,
      dirty: [...this.fm.dirty],
    };
    await savePending(snapshot);
  }
}

// Singleton — the whole app shares one store (one repo mounted at a time).
export const worklogStore = new WorklogStore();

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
