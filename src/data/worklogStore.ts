// The app's data layer. It loads a Worklog repo from GitHub into an in-memory
// file map, parses it with the domain `Store`, and exposes:
//   - a reactive `{ data, loading, gitPending }` snapshot the UI subscribes to
//     via `useSyncExternalStore` (see ui/hooks/useWorklogState), and
//   - direct async action methods (createTask, setWorklog, saveImage, …) the UI
//     calls straight — no message bus.
// Every persisted edit re-derives the state, marks the tree dirty, and arms a
// debounced auto-commit. Syncing goes both ways: it first asks GitHub where the
// branch head is, pulls when the branch moved, and pushes the dirty files back.
// GitHub can't tell us when someone else pushes, so an open tab also polls the
// branch head on a timer and on regaining focus, and pulls when it has no local
// changes of its own (see `checkRemote`).

import { Store } from '../store';
import { FileMap, deleteFile, mountFileMap } from '../workspace/paths';
import { today } from '../util/date';
import { createClient, createTask, deleteClient, setClientArchived, updateClient, type ClientFields, type NewTaskInput } from '../services/tasks';
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
import type { Client } from '../model/types';
import { DEFAULT_AUTO_SYNC } from '../workspace/paths';
import {
  clearPending,
  clearSnapshot,
  instanceId,
  loadPending,
  repoKeyOf,
  savePending,
  snapshotKeyOf,
  type PendingSnapshot,
} from './pendingStore';
import { mergeFile } from './merge';

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

/** One file in a commit payload: written (text or base64) or removed. Mirrors
 *  `CommitFile` on the server side of /api/commit. */
interface OutgoingFile {
  path: string;
  content?: string;
  base64?: string;
  deleted?: boolean;
}

export type ToastTone = 'loading' | 'success' | 'info' | 'error';

export interface ToastMessage {
  message: string;
  tone: ToastTone;
}

type Subscriber = () => void;
type ToastListener = (toast: ToastMessage | null) => void;

/** How often an open tab asks GitHub whether the branch moved. One ref lookup
 *  per tick — 60/hour against a 5000/hour rate limit — and only while the tab is
 *  visible, so a backgrounded tab costs nothing. */
const REMOTE_CHECK_INTERVAL_MS = 60_000;

/** Floor between two checks, so a burst of focus/visibility events (alt-tabbing,
 *  switching desktops) collapses into one request. */
const REMOTE_CHECK_MIN_GAP_MS = 10_000;

class WorklogStore {
  private store = new Store();
  private fm = new FileMap();
  private repo?: RepoContext;
  private loaded = false;
  private committing = false;
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private rolloverTimer: ReturnType<typeof setTimeout> | undefined;
  private watchTimer: ReturnType<typeof setTimeout> | undefined;
  private checkingRemote = false;
  /** Epoch millis of the last remote head check, for the min-gap throttle. */
  private lastRemoteCheck = 0;
  /** True once the focus/visibility listeners are registered (added once). */
  private watching = false;
  // A recovered snapshot loaded on open, held until the user restores or discards it.
  private recovered?: PendingSnapshot;
  /** `assets/<file>` -> object URL handed to the markdown renderer (see assetUrl). */
  private assetUrls = new Map<string, string>();

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
    let data: LoadResponse;
    try {
      data = await this.fetchRepo(owner, repo, branch);
    } catch (err) {
      this.updateSnapshot({ loading: false });
      this.emitToast(`Could not load ${owner}/${repo}: ${err instanceof Error ? err.message : String(err)}`, 'error');
      throw new Error('load failed');
    }
    this.applyLoad(data);
    await this.store.rebuild('open');
    this.loaded = true;
    this.updateSnapshot({ data: this.deriveState(), loading: false, gitPending: false });
    this.scheduleDateRollover();
    this.startWatchingRemote();
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
   *  them for the next sync. Rebuilds the domain model from the merged tree.
   *
   *  The branch may have moved since the snapshot was written, so a text file is
   *  three-way merged against what was just loaded rather than written over it —
   *  otherwise restoring would undo whatever reached the branch in the meantime. */
  async restorePending(): Promise<void> {
    const saved = this.recovered;
    if (!saved) {
      return;
    }
    this.recovered = undefined;
    const deleted = new Set(saved.deleted ?? []);
    const conflicts: string[] = [];
    for (const path of saved.dirty) {
      if (Object.prototype.hasOwnProperty.call(saved.binary, path)) {
        this.fm.binary.set(path, base64ToBytes(saved.binary[path]));
        this.fm.markDirty(path);
        continue;
      }
      const local = deleted.has(path) ? undefined : (saved.text[path] ?? '');
      const merged = mergeFile(path, { base: saved.baseText?.[path], local, remote: this.fm.text.get(path) });
      conflicts.push(...merged.conflicts);
      if (merged.text === undefined) {
        await deleteFile(path);
      } else {
        this.fm.text.set(path, merged.text);
        this.fm.deleted.delete(path);
        this.fm.markDirty(path);
      }
    }
    // Re-parse the merged file map; onDidChange refreshes the snapshot, re-persists
    // and arms auto-sync.
    await this.store.rebuild('restore');
    if (conflicts.length > 0) {
      this.emitToast(
        conflicts.length === 1 ? conflicts[0] : `${conflicts.length} recovered changes conflicted — kept your versions`,
        'info',
      );
    }
  }

  /** Drop the recovered snapshot without applying it, and delete it from storage.
   *  Only that snapshot: another instance's unsynced work stays recoverable. */
  async discardPending(): Promise<void> {
    const saved = this.recovered;
    this.recovered = undefined;
    if (saved) {
      await clearSnapshot(saved.key);
    }
  }

  /** Reload the current repo from GitHub, discarding uncommitted in-memory edits. */
  async reload(): Promise<void> {
    if (this.repo) {
      await this.open(this.repo.owner, this.repo.repo, this.repo.branch);
    }
  }

  /** Sync with the branch in both directions: pick up commits pushed elsewhere
   *  (another device, an edit on github.com) and commit the local dirty files.
   *  Used by the Sync button and the background debounce. Both report progress
   *  ("Syncing changes…" → "Changes synced") and failures; `silent` only
   *  suppresses the notices a background sync has no reason to announce. */
  async sync(options: { silent?: boolean } = {}): Promise<void> {
    const { silent = false } = options;
    if (!this.repo || this.committing) {
      return;
    }
    this.clearCommitTimer();
    this.committing = true;
    const hasLocalChanges = this.fm.dirty.size > 0;
    this.updateSnapshot({ loading: true });
    if (hasLocalChanges) {
      this.emitToast('Syncing changes…', 'loading');
    } else if (!silent) {
      this.emitToast('Checking for changes…', 'loading');
    }
    try {
      const head = await this.fetchHead();
      // This is a head check like the watcher's — don't let one follow the other.
      this.lastRemoteCheck = Date.now();
      const remoteMoved = head !== this.repo.baseCommitSha;
      if (!hasLocalChanges) {
        // Nothing to push, so the branch head is the whole story.
        if (remoteMoved) {
          await this.pull();
          this.emitToast('Pulled changes from GitHub', 'success');
        } else if (!silent) {
          this.emitToast('Everything is up to date', 'info');
        }
        return;
      }
      // Commit on top of what the branch holds now. A file only this instance
      // touched is written over as-is; one that changed on both sides is merged
      // record by record first, so the other instance's edits to it survive.
      if (remoteMoved) {
        await this.mergeRemote();
      }
      this.repo.baseCommitSha = head;
      const rebased = await this.pushDirty();
      if (remoteMoved || rebased) {
        // The commit merged in files the in-memory tree has never seen — reload so
        // what's on screen matches the branch. Safe: the push cleared the dirty set.
        await this.pull();
      }
      this.emitToast('Changes synced', 'success');
    } catch (err) {
      // Failures surface even for background syncs.
      this.emitToast(`Sync failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      this.committing = false;
      this.updateSnapshot({ loading: false });
    }
  }

  /** Commit the dirty files onto `baseCommitSha` and clear the dirty set. Retries
   *  once when the branch moves between the head check and the commit (409);
   *  returns true when it did, so the caller knows the in-memory tree is behind. */
  private async pushDirty(): Promise<boolean> {
    let rebased = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const files: OutgoingFile[] = [...this.fm.dirty].map((path) => {
        if (this.fm.deleted.has(path)) {
          return { path, deleted: true };
        }
        if (this.fm.binary.has(path)) {
          return { path, base64: bytesToBase64(this.fm.binary.get(path)!) };
        }
        return { path, content: this.fm.text.get(path) ?? '' };
      });
      const message = `chore: worklog sync ${today()}`;
      const res = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.repo!, message, files }),
      });
      if (res.status === 409) {
        // Someone pushed while this commit was in flight: merge against the new
        // head, re-base onto it and try again.
        const head = await this.fetchHead();
        await this.mergeRemote();
        this.repo!.baseCommitSha = head;
        rebased = true;
        continue;
      }
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = (await res.json()) as { commitSha: string };
      this.repo!.baseCommitSha = result.commitSha;
      // The branch now holds exactly what was just written, so a later delete of
      // any of these paths knows it has to reach GitHub — and the pushed content
      // becomes the ancestor the next merge compares against.
      for (const f of files) {
        if (f.deleted) {
          this.fm.remote.delete(f.path);
          this.fm.baseText.delete(f.path);
        } else {
          this.fm.remote.add(f.path);
          if (f.content !== undefined) {
            this.fm.baseText.set(f.path, f.content);
          }
        }
      }
      this.fm.deleted.clear();
      this.fm.clearDirty();
      this.clearPersistTimer();
      void clearPending(this.repoKey());
      this.updateSnapshot({ gitPending: false });
      return rebased;
    }
    throw new Error('the branch kept moving on GitHub — try again');
  }

  /** Reconcile the dirty files with the branch before pushing them.
   *
   *  A commit writes whole files, so pushing the local copy of a file the other
   *  instance also changed would drop its edits without a trace. This re-reads
   *  the branch and three-way merges every dirty text file against it (base =
   *  what this instance loaded, see FileMap.baseText), leaving the merged
   *  content in the file map for `pushDirty` to commit. Records added on either
   *  side survive; one changed on both keeps the local version and is reported.
   *
   *  Binaries (assets) carry generated, single-use names, so there is nothing to
   *  reconcile — the local bytes stand. */
  private async mergeRemote(): Promise<void> {
    if (!this.repo || this.fm.dirty.size === 0) {
      return;
    }
    const remote = await this.fetchRepo(this.repo.owner, this.repo.repo, this.repo.branch);
    const conflicts: string[] = [];
    let merged = false;
    for (const path of [...this.fm.dirty]) {
      if (this.fm.binary.has(path)) {
        continue;
      }
      const deletedHere = this.fm.deleted.has(path);
      const local = deletedHere ? undefined : this.fm.text.get(path);
      const remoteText = remote.text[path];
      const base = this.fm.baseText.get(path);
      // Nothing to reconcile unless the branch moved this file away from the
      // version the local edits were made on.
      if (remoteText === base) {
        continue;
      }
      const result = mergeFile(path, { base, local, remote: remoteText });
      conflicts.push(...result.conflicts);
      // The merge resolved against this remote version, so that's the ancestor
      // the next merge of this file has to compare against.
      if (remoteText !== undefined) {
        this.fm.baseText.set(path, remoteText);
      } else {
        this.fm.baseText.delete(path);
      }
      if (result.text === local) {
        continue;
      }
      merged = true;
      if (result.text === undefined) {
        this.fm.text.delete(path);
        this.fm.deleted.add(path);
      } else {
        this.fm.text.set(path, result.text);
        this.fm.deleted.delete(path);
      }
      this.fm.dirty.add(path);
    }
    if (merged) {
      // Show the merged tree now rather than after the push: if the commit fails,
      // what's on screen is still the version the retry will send.
      await this.store.rebuild('merge');
    }
    if (conflicts.length > 0) {
      this.emitToast(
        conflicts.length === 1 ? conflicts[0] : `${conflicts.length} changes conflicted with GitHub — kept your versions`,
        'info',
      );
    }
  }

  /** Re-read the branch from GitHub and re-render from it. Only call with an
   *  empty dirty set: the fetched tree replaces the in-memory one wholesale. */
  private async pull(): Promise<void> {
    if (!this.repo) {
      return;
    }
    this.applyLoad(await this.fetchRepo(this.repo.owner, this.repo.repo, this.repo.branch));
    await this.store.rebuild('pull');
    this.updateSnapshot({ data: this.deriveState(), gitPending: false });
  }

  // ---- actions (call the domain services directly) --------------------------

  createTask(input: NewTaskInput): Promise<void> {
    return this.run(() => createTask(this.store, input));
  }

  updateTask(taskId: string, fields: TaskFields): Promise<void> {
    return this.run(() => updateTask(this.store, taskId, fields));
  }

  /** Resolves to the created client, or undefined when the write failed (the
   *  error is already on screen as a toast). Callers need the id: a client added
   *  from inside a form is the one that form should switch to, and there is no
   *  other way back from a name to the id the service derived from it. */
  createClient(name: string, color?: string, fields?: Omit<ClientFields, 'name' | 'color'>): Promise<Client | undefined> {
    return this.runFor(() => createClient(this.store, { name, color, ...fields }));
  }

  updateClient(id: string, fields: ClientFields): Promise<void> {
    return this.run(() => updateClient(this.store, id, fields));
  }

  setClientArchived(id: string, archived: boolean): Promise<void> {
    return this.run(() => setClientArchived(this.store, id, archived));
  }

  deleteClient(id: string): Promise<void> {
    return this.run(() => deleteClient(this.store, id));
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

  /** Displayable URL for an `assets/<file>` markdown ref, or null when the file
   *  map doesn't hold it. Served from the in-memory bytes rather than a raw
   *  GitHub URL so a just-pasted image renders before it is ever committed, and
   *  so images in a private repo render at all (raw URLs there need a token an
   *  `<img>` can't send). URLs are cached per path and revoked on reload. */
  assetUrl(ref: string): string | null {
    const cached = this.assetUrls.get(ref);
    if (cached) {
      return cached;
    }
    const bytes = this.fm.binary.get(ref);
    if (!bytes) {
      return null;
    }
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeOfAsset(ref) }));
    this.assetUrls.set(ref, url);
    return url;
  }

  // ---- internals ------------------------------------------------------------

  /** Run a mutating action, surfacing any failure as a toast. */
  private async run(action: () => Promise<unknown>): Promise<void> {
    await this.runFor(action);
  }

  /** `run` for an action whose result the caller needs; `undefined` means it
   *  threw and the toast has already been raised. */
  private async runFor<T>(action: () => Promise<T>): Promise<T | undefined> {
    try {
      return await action();
    } catch (err) {
      this.emitToast(err instanceof Error ? err.message : String(err), 'error');
      return undefined;
    }
  }

  private deriveState(): WorklogState {
    const config = this.store.getConfig();
    return {
      today: today(),
      hoursPerDay: config.hoursPerDay,
      weekStart: config.weekStart,
      todosPerPage: config.todosPerPage,
      autoSync: config.autoSync,
      statuses: config.statuses,
      // The general to-do bucket is a task-only concept; keep it out of the
      // client list so it never surfaces in billing (log form, dashboard, totals).
      clients: this.store.db.getClients().filter((c) => !isGeneralTodoClientId(c.id)),
      tasks: this.store.db.getAllTasks(),
      worklog: this.store.db.getAllWorklog(),
    };
  }

  private applyLoad(data: LoadResponse): void {
    // The old file map's bytes are about to go away; drop the URLs pointing at them.
    for (const url of this.assetUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.assetUrls.clear();
    this.fm = new FileMap();
    for (const [path, text] of Object.entries(data.text)) {
      this.fm.text.set(path, text);
      // The version every later edit is a change *from*, for the sync merge.
      this.fm.baseText.set(path, text);
    }
    for (const [path, base64] of Object.entries(data.binary)) {
      this.fm.binary.set(path, base64ToBytes(base64));
    }
    for (const [path, sha] of Object.entries(data.sha)) {
      this.fm.baseSha.set(path, sha);
    }
    // Everything that came back from the branch exists there — see FileMap.remote.
    for (const path of [...this.fm.text.keys(), ...this.fm.binary.keys()]) {
      this.fm.remote.add(path);
    }
    mountFileMap(this.fm);
    this.repo = { owner: data.owner, repo: data.repo, branch: data.branch, baseCommitSha: data.baseCommitSha };
  }

  /** Fetch a branch's Worklog files from GitHub (the token stays server-side). */
  private async fetchRepo(owner: string, repo: string, branch?: string): Promise<LoadResponse> {
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

  /** The branch's head commit on GitHub right now. Throws when the check fails —
   *  a sync that can't see the branch must not claim everything is up to date. */
  private async fetchHead(): Promise<string> {
    const { owner, repo, branch } = this.repo!;
    const params = new URLSearchParams({ owner, repo, branch });
    const res = await fetch(`/api/head?${params}`);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return ((await res.json()) as { commitSha: string }).commitSha;
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

  /** Start watching GitHub for commits pushed elsewhere (another device, an edit
   *  on github.com). Nothing notifies us, so this polls: on a timer while the tab
   *  is visible, and immediately when the tab regains focus — the case that
   *  actually matters, since you come back to this tab after pushing from the
   *  other device. Without it a tab that isn't edited never learns the branch
   *  moved, because the only other head check lives in `sync()`. */
  private startWatchingRemote(): void {
    this.scheduleRemoteCheck();
    if (this.watching || typeof document === 'undefined') {
      return;
    }
    this.watching = true;
    document.addEventListener('visibilitychange', this.onTabActive);
    window.addEventListener('focus', this.onTabActive);
  }

  private onTabActive = (): void => {
    void this.checkRemote();
  };

  private scheduleRemoteCheck(): void {
    this.clearWatchTimer();
    this.watchTimer = setTimeout(() => {
      void this.checkRemote().then(() => this.scheduleRemoteCheck());
    }, REMOTE_CHECK_INTERVAL_MS);
  }

  /** Ask where the branch head is and pull when it moved. Read-only as far as
   *  local work goes: with dirty files this backs off entirely and leaves the
   *  merge to `sync()`, which knows how to commit on top of the new head. */
  private async checkRemote(): Promise<void> {
    if (!this.repo || !this.loaded || this.committing || this.checkingRemote || this.fm.dirty.size > 0) {
      return;
    }
    // A hidden tab has nothing to show; the visibility listener catches up.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    const now = Date.now();
    if (now - this.lastRemoteCheck < REMOTE_CHECK_MIN_GAP_MS) {
      return;
    }
    this.lastRemoteCheck = now;
    this.checkingRemote = true;
    try {
      const head = await this.fetchHead();
      // Re-check the guards: an edit or a sync may have started in flight.
      if (head === this.repo.baseCommitSha || this.committing || this.fm.dirty.size > 0) {
        return;
      }
      await this.pull();
      this.emitToast('Pulled changes from GitHub', 'success');
    } catch {
      // Offline or a transient GitHub failure. A background check has no reason
      // to interrupt with a toast — the next tick tries again.
    } finally {
      this.checkingRemote = false;
    }
  }

  private clearWatchTimer(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = undefined;
    }
  }

  /** Re-derive the state just after local midnight. `today` is only recomputed
   *  when the state is derived, so without this a tab left open overnight keeps
   *  yesterday's date: nothing would become overdue and a recurring task due the
   *  next day would never move into the day view. */
  private scheduleDateRollover(): void {
    this.clearRolloverTimer();
    const now = new Date();
    // 30s past midnight, so a timer firing a touch early still lands on the new day.
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 30);
    this.rolloverTimer = setTimeout(
      () => {
        if (this.loaded) {
          this.updateSnapshot({ data: this.deriveState() });
        }
        this.scheduleDateRollover();
      },
      Math.max(1_000, nextMidnight.getTime() - now.getTime()),
    );
  }

  private clearRolloverTimer(): void {
    if (this.rolloverTimer) {
      clearTimeout(this.rolloverTimer);
      this.rolloverTimer = undefined;
    }
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
    const baseText: Record<string, string> = {};
    const binary: Record<string, string> = {};
    const deleted: string[] = [];
    for (const path of this.fm.dirty) {
      if (this.fm.deleted.has(path)) {
        deleted.push(path);
      } else if (this.fm.binary.has(path)) {
        binary[path] = bytesToBase64(this.fm.binary.get(path)!);
      } else {
        text[path] = this.fm.text.get(path) ?? '';
      }
      // Mirror the ancestor too: a restore three-way merges against the branch,
      // and by then this instance's in-memory base is gone.
      const base = this.fm.baseText.get(path);
      if (base !== undefined) {
        baseText[path] = base;
      }
    }
    const snapshot: PendingSnapshot = {
      key: snapshotKeyOf(this.repoKey(), instanceId()),
      instanceId: instanceId(),
      repoKey: this.repoKey(),
      owner: this.repo.owner,
      repo: this.repo.repo,
      branch: this.repo.branch,
      baseCommitSha: this.repo.baseCommitSha,
      savedAt: Date.now(),
      text,
      baseText,
      binary,
      dirty: [...this.fm.dirty],
      deleted,
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

/** Content type for an asset path, from its extension (see services/assets for
 *  the extensions written). Unknown ones fall back to PNG, matching that writer. */
function mimeOfAsset(path: string): string {
  const ext = (path.split('.').pop() ?? '').toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
