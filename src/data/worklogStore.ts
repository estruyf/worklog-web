// The app's data layer. It loads a Worklog repo from GitHub into an in-memory
// file map, parses it with the domain `Store`, and exposes:
//   - a reactive `{ data, loading, gitPending }` snapshot the UI subscribes to
//     via `useSyncExternalStore` (see ui/hooks/useWorklogState), and
//   - direct async action methods (createTask, setWorklog, saveImage, …) the UI
//     calls straight — no message bus.
// Every persisted edit re-derives the state, marks the tree dirty, and arms a
// debounced auto-commit — a short one when the edit is one of the change kinds
// configured to sync on, the configured delay otherwise (see `scheduleCommit`).
// Syncing goes both ways: it first asks GitHub where the branch head is, pulls
// when the branch moved, and pushes the dirty files back.
//
// What lives here is the sequencing — when to fetch, merge, re-parse, notify and
// re-render. The pieces it sequences are their own modules: `repoApi` (the three
// server calls), `fileSync` (merge/commit arithmetic over a FileMap), `recovery`
// (the IndexedDB snapshot), `assetUrls` (image object URLs) and `remoteWatcher`
// (the poll for commits pushed elsewhere).

import { Store } from '../store';
import { FileMap, mountFileMap } from '../workspace/paths';
import { today } from '../util/date';
import { createClient, createTask, deleteClient, setClientArchived, updateClient, type ClientFields, type NewTaskInput } from '../services/tasks';
import { saveImageAsset } from '../services/assets';
import { isGeneralTodoClientId } from '../model/todos';
import {
  addTaskNote,
  closeTaskById,
  deleteTaskCascade,
  deleteTaskNote,
  endTaskSeries,
  setTaskCompletedDate,
  setTaskStatus,
  toggleTaskWorkedOn,
  updateTask,
  updateTaskNote,
  type TaskFields,
} from '../services/taskOps';
import { removeWorklog, setEventWorklog, setWorklog } from '../services/worklog';
import { setDayNote } from '../services/dayNotes';
import { updateSettings, type SettingsFields } from '../services/settings';
import { createStatus, deleteStatus, moveStatus, updateStatus, type NewStatusInput, type StatusFields } from '../services/statuses';
import type { WorklogState } from '../ui/state';
import type { AutoSyncConfig, Client, Task } from '../model/types';
import { syncsOnChange } from '../model/syncEvents';
import { DEFAULT_AUTO_SYNC } from '../workspace/paths';
import { clearPending, clearSnapshot, loadPending, repoKeyOf, savePending, type PendingSnapshot } from './pendingStore';
import { AssetUrlCache } from './assetUrls';
import { commitFiles, fetchAsset, fetchHead, fetchRepo, type LoadResponse, type RepoContext } from './repoApi';
import { fileMapOf, markPushed, mergeRemoteInto, outgoingFiles } from './fileSync';
import { applySnapshot, snapshotOf } from './recovery';
import { loadResponseOf, loadTree, saveTree } from './repoCache';
import { RemoteWatcher } from './remoteWatcher';

/** True only when the browser positively reports having no connection.
 *
 *  `navigator.onLine` doesn't exist outside a browser (tests, SSR), and an absent
 *  signal has to read as online: a false "offline" would park every sync behind a
 *  reconnect event that is never coming. A true one is only ever a hint in the
 *  other direction too — the machine can be on a network that reaches nothing —
 *  which is why the sync failure path stays intact underneath this. */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

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
  /** How many files hold changes GitHub hasn't seen. `gitPending` is this being
   *  non-zero; the count is what lets the UI say how much is waiting rather than
   *  only that something is. */
  pendingCount: number;
  /** No connection: edits are being kept on the device, and what is on screen may
   *  be the cached branch rather than the live one. Drives the UI's offline
   *  indicator — the store emits no toast for it, because going offline is a
   *  state to show, not an event to announce once and lose. */
  offline: boolean;
  /** The message of the last sync attempt that failed while online. Standing
   *  state, unlike the toast that announced it once: a sync that has been failing
   *  all day must stay visible all day. Cleared only when GitHub is reached again
   *  (a sync lands, a load succeeds, or the watcher confirms a clean tree). */
  syncError: string | null;
  /** Epoch millis of the last time this device confirmed it agrees with the
   *  branch — a sync landed, a load finished, or a head check found nothing new
   *  with nothing pending. Null until the first such moment this session. */
  lastSyncedAt: number | null;
}

export type ToastTone = 'loading' | 'success' | 'info' | 'error';

export interface ToastMessage {
  message: string;
  tone: ToastTone;
  /** An inline follow-up on the toast itself — "Undo", mostly. `run` fires once,
   *  on click; the toast is dismissed by the UI right after. */
  action?: { label: string; run: () => void };
}

type Subscriber = () => void;
type ToastListener = (toast: ToastMessage | null) => void;

/** Debounce before the dirty files are mirrored to IndexedDB, so a burst of edits
 *  coalesces into a single write. */
const PERSIST_DEBOUNCE_MS = 800;

/** Debounce before a sync triggered by one of the configured events. Not zero:
 *  ticking a task off is two writes often enough (close, then the note about it),
 *  and a couple of seconds is still "right away" to the person who did it. */
const EVENT_SYNC_DEBOUNCE_MS = 2_000;

class WorklogStore {
  private store = new Store();
  private fm = new FileMap();
  private repo?: RepoContext;
  private loaded = false;
  private committing = false;
  private commitTimer: ReturnType<typeof setTimeout> | undefined;
  /** True while `commitTimer` is the short event-triggered one rather than the
   *  `delayMinutes` one, so a later edit can't quietly push it back. */
  private eventSyncArmed = false;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private rolloverTimer: ReturnType<typeof setTimeout> | undefined;
  // A recovered snapshot loaded on open, held until the user restores or discards it.
  private recovered?: PendingSnapshot;
  private assetUrls = new AssetUrlCache();
  /** Asset paths with a download in flight, so a re-render doesn't start a second. */
  private assetFetches = new Set<string>();
  /** A sync was wanted while there was no connection. It says the user (or a
   *  trigger they configured) already asked for this work to reach GitHub, which
   *  is what makes it right to push on reconnect without asking again — and what
   *  keeps "auto-sync off" meaning nothing syncs unprompted. */
  private deferredSync = false;
  private watcher = new RemoteWatcher(
    () => this.checkRemote(),
    () => !!this.repo && this.loaded && !this.committing && this.fm.dirty.size === 0 && !isOffline(),
  );

  private subscribers = new Set<Subscriber>();
  private toastListeners = new Set<ToastListener>();
  // Cached immutable snapshot: `getSnapshot` must return a stable reference between
  // changes so `useSyncExternalStore` doesn't loop. Rebuilt only on transitions.
  private snapshot: WorklogSnapshot = { data: null, loading: false, gitPending: false, pendingCount: 0, offline: isOffline(), syncError: null, lastSyncedAt: null };

  constructor() {
    // Every persisted edit re-derives the state, flags the tree dirty, and arms
    // the debounced auto-commit. The reason decides which debounce: the change
    // kinds the user picked in Settings sync in seconds, everything else waits.
    this.store.onDidChange((reason) => {
      this.updateSnapshot({ data: this.deriveState(), ...this.dirtyPatch() });
      this.scheduleCommit(reason);
      this.schedulePersist();
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', this.onConnectionLost);
      window.addEventListener('online', this.onConnectionBack);
      window.addEventListener('focus', this.checkDateRollover);
    }
    // Separately from `window`, and not because a browser ever has one without the
    // other: guarding on what is actually about to be touched is what keeps this
    // from throwing wherever only part of the pair is stubbed. The two events
    // answer different absences — `visibilitychange` a tab that was in the
    // background (or frozen there), `focus` a window that was behind another app
    // with the tab visible the whole time.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onTabVisible);
    }
  }

  /** Nothing to do but show it: the edits are already going to the file map and
   *  the debounced persist, and a sync that fires meanwhile now declines itself. */
  private onConnectionLost = (): void => {
    this.updateSnapshot({ offline: true });
  };

  /** Reconnected. Push what was waiting, or — when nothing is — find out how far
   *  the branch has moved, which after an open from cache is the whole point:
   *  what's on screen is as old as the last time this device was online.
   *
   *  Same policy as `scheduleRetry`, and for the same reason: automatic sync (by
   *  timer or by event) means work leaves on its own, so a reconnect is simply the
   *  soonest that can happen. With both off, nothing leaves unprompted — unless
   *  the user pressed Sync while offline, which is them having asked already. */
  private onConnectionBack = (): void => {
    this.updateSnapshot({ offline: false });
    if (!this.repo || !this.loaded || this.committing) {
      return;
    }
    if (this.fm.dirty.size === 0) {
      void this.checkRemote();
      return;
    }
    const autoSync = this.autoSyncConfig();
    if (this.deferredSync || autoSync.enabled || autoSync.events.length > 0) {
      this.deferredSync = false;
      void this.sync({ silent: true });
    }
  };

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

  /** Raise a toast from the UI layer — action confirmations, with an optional
   *  Undo. Same channel the store's own sync/error toasts go out on, so there is
   *  exactly one toast on screen at a time whoever raised it. */
  notify(toast: ToastMessage): void {
    for (const l of this.toastListeners) {
      l(toast);
    }
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

  /** Load a repo from GitHub and render it, falling back to the copy this device
   *  cached the last time it managed to (see `openFromCache`). */
  async open(owner: string, repo: string, branch?: string): Promise<void> {
    this.updateSnapshot({ loading: true });
    let data: LoadResponse;
    try {
      data = await fetchRepo(owner, repo, branch);
    } catch (err) {
      if (await this.openFromCache(owner, repo, branch)) {
        return;
      }
      this.updateSnapshot({ loading: false });
      this.emitToast(`Could not load ${owner}/${repo}: ${err instanceof Error ? err.message : String(err)}`, 'error');
      throw new Error('load failed');
    }
    this.applyLoad(data);
    await this.store.rebuild('open');
    this.loaded = true;
    this.updateSnapshot({ data: this.deriveState(), loading: false, ...this.dirtyPatch(), offline: false, syncError: null, lastSyncedAt: Date.now() });
    this.scheduleDateRollover();
    this.watcher.start();
    void this.saveTreeCache();
    await this.loadRecovery();
  }

  /** Open the branch from the device-side cache after the load failed. Returns
   *  false when there is nothing cached — a repo this device has never opened —
   *  and the caller falls back to the error screen.
   *
   *  Unsynced edits are re-applied here rather than offered through the recovery
   *  prompt. That prompt asks a question ("restore or discard?") that only makes
   *  sense after something went wrong; reopening the app on a train is not
   *  something going wrong, and being asked to justify your own unsent work
   *  before you can see it would be the wrong first screen. Everything else about
   *  them is unchanged — they are still dirty, still snapshotted, and still merge
   *  record by record on the way out. */
  private async openFromCache(owner: string, repo: string, branch?: string): Promise<boolean> {
    const tree = await loadTree(owner, repo, branch);
    if (!tree) {
      return false;
    }
    this.applyLoad(loadResponseOf(tree), tree.remote);
    await this.store.rebuild('open');
    this.loaded = true;
    this.recovered = undefined;

    const saved = await loadPending(this.repoKey());
    const conflicts = saved && saved.dirty.length > 0 ? applySnapshot(this.fm, saved) : [];
    if (saved && saved.dirty.length > 0) {
      await this.store.rebuild('restore');
    }

    this.updateSnapshot({ data: this.deriveState(), loading: false, ...this.dirtyPatch(), offline: true });
    this.scheduleDateRollover();
    this.watcher.start();
    this.reportConflicts(conflicts, 'local changes conflicted — kept your versions');
    return true;
  }

  /** Mirror the branch content for the next offline open. Fire-and-forget: a
   *  cache that fails to write costs nothing now and is retried on the next
   *  load, pull or push. */
  private async saveTreeCache(): Promise<void> {
    if (!this.repo) {
      return;
    }
    await saveTree(this.fm, this.repo, Date.now());
  }

  /** Reload the current repo from GitHub, discarding uncommitted in-memory edits. */
  async reload(): Promise<void> {
    if (this.repo) {
      await this.open(this.repo.owner, this.repo.repo, this.repo.branch);
    }
  }

  // ---- crash/close recovery -------------------------------------------------

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

  /** Re-apply the recovered snapshot over the loaded repo and rebuild the domain
   *  model from the merged tree. */
  async restorePending(): Promise<void> {
    const saved = this.recovered;
    if (!saved) {
      return;
    }
    this.recovered = undefined;
    const conflicts = applySnapshot(this.fm, saved);
    // Re-parse the merged file map; onDidChange refreshes the snapshot, re-persists
    // and arms auto-sync.
    await this.store.rebuild('restore');
    this.reportConflicts(conflicts, 'recovered changes conflicted — kept your versions');
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

  // ---- sync -----------------------------------------------------------------

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
    // Offline: don't spend a request to be told so. The edits are already in the
    // file map and the debounced persist, so this is a deferral, not a failure —
    // and reporting it as one (a "Sync failed" toast per debounce, all evening)
    // is what made an offline session look like a broken app.
    if (isOffline()) {
      this.deferredSync = this.deferredSync || this.fm.dirty.size > 0;
      this.updateSnapshot({ offline: true });
      if (!silent) {
        this.emitToast(
          this.fm.dirty.size > 0
            ? 'Offline — your changes are saved here and will sync when you reconnect'
            : 'Offline — nothing to sync until you reconnect',
          'info',
        );
      }
      // Belt and braces for the reconnect: `online` is the fast path, but it does
      // not fire behind every captive portal, and a timesheet must not need one.
      this.scheduleRetry();
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
      const head = await fetchHead(this.repo);
      // Reaching GitHub is the only proof of connectivity worth trusting, and the
      // only one that clears the indicator when `online` never fired.
      this.deferredSync = false;
      if (this.snapshot.offline) {
        this.updateSnapshot({ offline: false });
      }
      // This is a head check like the watcher's — don't let one follow the other.
      this.watcher.markChecked();
      const remoteMoved = head !== this.repo.baseCommitSha;
      if (!hasLocalChanges) {
        // Nothing to push, so the branch head is the whole story.
        if (remoteMoved) {
          await this.pull();
          this.emitToast('Pulled changes from GitHub', 'success');
        } else if (!silent) {
          this.emitToast('Everything is up to date', 'info');
        }
        this.markSynced();
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
      this.markSynced();
    } catch (err) {
      // The connection can drop mid-sync as easily as before one. That reads as a
      // failed request here, but it is the offline case, and it gets the offline
      // treatment: keep the work, show the state, say nothing.
      if (isOffline()) {
        this.deferredSync = true;
        this.updateSnapshot({ offline: true });
      } else {
        // Failures surface even for background syncs — as the toast that announces
        // this one, and as the standing `syncError` the status bar holds up until
        // an attempt lands. The toast alone was the whole story once, and a sync
        // that failed all day looked like four seconds of trouble.
        this.updateSnapshot({ syncError: err instanceof Error ? err.message : String(err) });
        this.emitToast(`Sync failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    } finally {
      this.committing = false;
      this.updateSnapshot({ loading: false });
      // Anything still dirty here has no timer coming for it. Two ways to get
      // there: the sync above threw (offline, a GitHub blip) and left the files
      // unpushed, or an edit landed mid-sync and `scheduleCommit` declined to arm
      // while `committing` was set. Both used to park the changes until the user
      // made another edit or pressed Sync — silently, which is the one failure
      // mode a timesheet can't afford.
      if (this.fm.dirty.size > 0) {
        this.scheduleRetry();
      }
    }
  }

  /** Commit the dirty files onto `baseCommitSha` and clear the dirty set. Retries
   *  once when the branch moves between the head check and the commit (409);
   *  returns true when it did, so the caller knows the in-memory tree is behind. */
  private async pushDirty(): Promise<boolean> {
    let rebased = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const files = outgoingFiles(this.fm);
      const result = await commitFiles(this.repo!, `chore: worklog sync ${today()}`, files);
      if (result.conflict) {
        // Someone pushed while this commit was in flight: merge against the new
        // head, re-base onto it and try again.
        const head = await fetchHead(this.repo!);
        await this.mergeRemote();
        this.repo!.baseCommitSha = head;
        rebased = true;
        continue;
      }
      this.repo!.baseCommitSha = result.commitSha;
      markPushed(this.fm, files);
      // An edit that landed while the commit was in flight is not in what just
      // shipped, so it stays dirty — and its recovery snapshot has to stay with it.
      // Dropping the snapshot here regardless is how that edit used to become
      // unrecoverable as well as uncommitted. `sync`'s `finally` arms the retry.
      const settled = this.fm.dirty.size === 0;
      if (settled) {
        this.clearPersistTimer();
        void clearPending(this.repoKey());
      }
      // The push moved the baseline, so the cached copy is now a commit behind.
      // Refreshed even when something stayed dirty: what this writes is the
      // branch content, which the unpushed edit is a change *from*.
      void this.saveTreeCache();
      this.updateSnapshot(this.dirtyPatch());
      return rebased;
    }
    throw new Error('the branch kept moving on GitHub — try again');
  }

  /** Re-read the branch and reconcile the dirty files with it before pushing them,
   *  leaving the merged content in the file map for `pushDirty` to commit. */
  private async mergeRemote(): Promise<void> {
    if (!this.repo || this.fm.dirty.size === 0) {
      return;
    }
    const remote = await fetchRepo(this.repo.owner, this.repo.repo, this.repo.branch);
    const { conflicts, merged } = mergeRemoteInto(this.fm, remote.text);
    if (merged) {
      // Show the merged tree now rather than after the push: if the commit fails,
      // what's on screen is still the version the retry will send.
      await this.store.rebuild('merge');
    }
    this.reportConflicts(conflicts, 'changes conflicted with GitHub — kept your versions');
  }

  /** Re-read the branch from GitHub and re-render from it. Only call with an
   *  empty dirty set: the fetched tree replaces the in-memory one wholesale. */
  private async pull(): Promise<void> {
    if (!this.repo) {
      return;
    }
    this.applyLoad(await fetchRepo(this.repo.owner, this.repo.repo, this.repo.branch));
    await this.store.rebuild('pull');
    this.updateSnapshot({ data: this.deriveState(), ...this.dirtyPatch() });
    void this.saveTreeCache();
  }

  /** Ask where the branch head is and pull when it moved. Read-only as far as
   *  local work goes: the watcher only calls this with a clean tree, and the merge
   *  is left to `sync()`, which knows how to commit on top of the new head. */
  private async checkRemote(): Promise<void> {
    try {
      const head = await fetchHead(this.repo!);
      // Re-check the guards: an edit or a sync may have started in flight.
      if (this.committing || this.fm.dirty.size > 0) {
        return;
      }
      if (head === this.repo!.baseCommitSha) {
        // Nothing pending, nothing new: agreement, freshly confirmed.
        this.markSynced();
        return;
      }
      await this.pull();
      this.markSynced();
      this.emitToast('Pulled changes from GitHub', 'success');
    } catch {
      // Offline or a transient GitHub failure. A background check has no reason
      // to interrupt with a toast — the next tick tries again.
    }
  }

  // ---- actions (call the domain services directly) --------------------------

  /** Resolves to the created task, or undefined when the write failed (the error
   *  is already on screen as a toast). Callers need the id: saving the new-task
   *  form ends on the task it just made, and the id is minted inside the service. */
  createTask(input: NewTaskInput): Promise<Task | undefined> {
    return this.runFor(() => createTask(this.store, input));
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

  createStatus(input: NewStatusInput): Promise<void> {
    return this.run(() => createStatus(this.store, input));
  }

  updateStatus(id: string, fields: StatusFields): Promise<void> {
    return this.run(() => updateStatus(this.store, id, fields));
  }

  moveStatus(id: string, delta: -1 | 1): Promise<void> {
    return this.run(() => moveStatus(this.store, id, delta));
  }

  deleteStatus(id: string): Promise<void> {
    return this.run(() => deleteStatus(this.store, id));
  }

  /** Resolves to the closed task, or undefined when the write failed (the error
   *  is already on screen as a toast) — callers offering Undo need to know the
   *  close actually happened before promising to reverse it. */
  closeTask(taskId: string, date?: string): Promise<Task | undefined> {
    return this.runFor(() => closeTaskById(this.store, taskId, date));
  }

  /** Archive a recurring task instead of rolling it forward — the series ends. */
  endSeries(taskId: string, date?: string): Promise<void> {
    return this.run(() => endTaskSeries(this.store, taskId, date));
  }

  setCompletedDate(taskId: string, date: string): Promise<void> {
    return this.run(() => setTaskCompletedDate(this.store, taskId, date));
  }

  toggleWorked(taskId: string, date: string): Promise<void> {
    return this.run(() => toggleTaskWorkedOn(this.store, taskId, date));
  }

  /** Same contract as `closeTask`: the resulting task, or undefined on failure. */
  setStatus(taskId: string, statusId: string): Promise<Task | undefined> {
    return this.runFor(() => setTaskStatus(this.store, taskId, statusId));
  }

  deleteTask(taskId: string): Promise<void> {
    return this.run(() => deleteTaskCascade(this.store, taskId));
  }

  addNote(taskId: string, text: string): Promise<void> {
    return this.run(() => addTaskNote(this.store, taskId, text));
  }

  updateNote(taskId: string, index: number, text: string): Promise<void> {
    return this.run(() => updateTaskNote(this.store, taskId, index, text));
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

  /** Write (or clear, with an empty body) the freeform note for one day. */
  setDayNote(date: string, body: string): Promise<void> {
    return this.run(() => setDayNote(this.store, date, body));
  }

  /** Save a pasted/dropped/picked image and return the markdown ref to insert. */
  async saveImage(dataBase64: string, ext: string): Promise<string> {
    const ref = await saveImageAsset(this.store, dataBase64, ext);
    // Image bytes are written straight to the file map (no store rebuild), so mirror
    // them for recovery here too — the referencing edit will follow and re-persist.
    this.schedulePersist();
    return ref;
  }

  /** Displayable URL for an `assets/<file>` markdown ref, or null when the bytes
   *  aren't in memory (yet). Loads ship asset paths + shas without bytes, so a
   *  null here also starts the download; when it lands, subscribers are notified
   *  and the re-render finds the bytes. See data/assetUrls for why these aren't
   *  raw GitHub URLs. */
  assetUrl(ref: string): string | null {
    const bytes = this.fm.binary.get(ref);
    if (!bytes) {
      this.fetchMissingAsset(ref);
    }
    return this.assetUrls.urlFor(ref, bytes);
  }

  /** Start downloading an asset the branch holds but the map has no bytes for.
   *  Quietly does nothing for refs the branch doesn't know (a just-pasted image
   *  already has bytes; a dangling ref has nothing to fetch) and for locally
   *  deleted assets — refetching one of those would visibly resurrect it. A
   *  failed download (offline, say) just leaves the alt-text fallback standing;
   *  a later render retries. */
  private fetchMissingAsset(ref: string): void {
    const sha = this.fm.baseSha.get(ref);
    if (!sha || !this.repo || this.fm.deleted.has(ref) || this.assetFetches.has(ref)) {
      return;
    }
    this.assetFetches.add(ref);
    const fm = this.fm;
    fetchAsset(this.repo, ref, sha)
      .then((bytes) => {
        // A reload swapped the map while this was in flight: drop the bytes and
        // let the next render fetch against the new map (the HTTP cache makes
        // that cheap).
        if (this.fm !== fm || fm.deleted.has(ref)) {
          return;
        }
        fm.binary.set(ref, bytes);
        this.updateSnapshot({});
      })
      .catch(() => undefined)
      .finally(() => this.assetFetches.delete(ref));
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
      defaultTaskSort: config.defaultTaskSort,
      autoSync: config.autoSync,
      aiAgents: config.aiAgents,
      statuses: config.statuses,
      // The general to-do bucket is a task-only concept; keep it out of the
      // client list so it never surfaces in billing (log form, dashboard, totals).
      clients: this.store.db.getClients().filter((c) => !isGeneralTodoClientId(c.id)),
      tasks: this.store.db.getAllTasks(),
      worklog: this.store.db.getAllWorklog(),
      dayNotes: this.store.db.getAllDayNotes(),
    };
  }

  /** Swap in the tree a load returned and mount it for the services.
   *
   *  `remotePaths` is for the cached open, whose response carries no asset bytes:
   *  without it the map would forget the branch holds those files at all, and
   *  deleting one would commit as "drop a file that was never pushed" — a no-op
   *  that leaves it on GitHub. Online, the response is the whole branch and the
   *  paths it carries are the answer. */
  private applyLoad(data: LoadResponse, remotePaths?: string[]): void {
    // The old file map's bytes are about to go away; drop the URLs pointing at them.
    this.assetUrls.revokeAll();
    this.fm = fileMapOf(data);
    for (const path of remotePaths ?? []) {
      this.fm.remote.add(path);
    }
    mountFileMap(this.fm);
    this.repo = { owner: data.owner, repo: data.repo, branch: data.branch, baseCommitSha: data.baseCommitSha };
  }

  /** The pending-changes half of the snapshot, derived rather than passed in.
   *  Every caller used to spell out `gitPending` for itself, and a second field
   *  saying the same thing is how the two drift apart. */
  private dirtyPatch(): Pick<WorklogSnapshot, 'gitPending' | 'pendingCount'> {
    return { gitPending: this.fm.dirty.size > 0, pendingCount: this.fm.dirty.size };
  }

  /** Merge a partial into the cached snapshot (new reference) and notify. */
  private updateSnapshot(patch: Partial<WorklogSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.subscribers) {
      l();
    }
  }

  /** A round trip just confirmed this device and the branch agree (or resolved
   *  the disagreement). Stamps "last synced" and stands down the failure state. */
  private markSynced(): void {
    this.updateSnapshot({ syncError: null, lastSyncedAt: Date.now() });
  }

  private emitToast(message: string, tone: ToastTone): void {
    const toast: ToastMessage = { message, tone };
    for (const l of this.toastListeners) {
      l(toast);
    }
  }

  /** Say what a merge had to decide for you: the one message when there is one,
   *  a count and `summary` when there are several, nothing when there are none. */
  private reportConflicts(conflicts: string[], summary: string): void {
    if (conflicts.length === 0) {
      return;
    }
    this.emitToast(conflicts.length === 1 ? conflicts[0] : `${conflicts.length} ${summary}`, 'info');
  }

  private repoKey(): string {
    if (!this.repo) {
      return '';
    }
    return repoKeyOf(this.repo.owner, this.repo.repo, this.repo.branch);
  }

  // ---- timers ---------------------------------------------------------------

  /** Arm the debounced auto-commit for a change made for `reason`. Two ways in:
   *  the change is one of the events the user asked to sync on, and it goes in
   *  seconds; or timed auto-sync is enabled, and it waits out `delayMinutes` so a
   *  burst of edits coalesces into one sync. With neither, nothing is armed and
   *  the changes wait for the Sync button. Manual sync and 409 retries bypass this. */
  private scheduleCommit(reason: string): void {
    const autoSync = this.autoSyncConfig();
    const onEvent = syncsOnChange(autoSync.events, reason);
    // An event sync already counting down is not pushed back by a change that
    // isn't itself a trigger. "Sync when I create a task" has to mean that task
    // reaches GitHub in seconds, whatever else gets typed in the meantime.
    if (this.eventSyncArmed && !onEvent) {
      return;
    }
    // Disarm first, then decide: turning auto-sync off has to cancel the timer that
    // is already running, not merely stop the next one being set.
    this.clearCommitTimer();
    // A sync in flight would swallow the timer's call (`sync` returns early while
    // `committing`), so don't arm one — `sync`'s own `finally` re-arms instead.
    if (this.committing || (!onEvent && !autoSync.enabled)) {
      return;
    }
    if (onEvent) {
      this.eventSyncArmed = true;
      this.commitTimer = setTimeout(() => {
        // Clear before syncing, not from inside `sync`: it returns early when a
        // sync is already running, and a flag left set would block every later
        // timer from being armed.
        this.eventSyncArmed = false;
        this.commitTimer = undefined;
        void this.sync({ silent: true });
      }, EVENT_SYNC_DEBOUNCE_MS);
      return;
    }
    this.commitTimer = setTimeout(() => void this.sync({ silent: true }), this.autoSyncDelayMs(autoSync));
  }

  /** Re-arm after a sync left files behind (it failed, or an edit landed mid-flight).
   *  Event triggers count as automatic sync being on here: work stranded by a failed
   *  event sync must not sit until the user happens to trigger another one. Uses the
   *  delay rather than the event debounce — this is a retry, not a fresh change. */
  private scheduleRetry(): void {
    this.clearCommitTimer();
    const autoSync = this.autoSyncConfig();
    if (this.committing || (!autoSync.enabled && autoSync.events.length === 0)) {
      return;
    }
    this.commitTimer = setTimeout(() => void this.sync({ silent: true }), this.autoSyncDelayMs(autoSync));
  }

  private autoSyncConfig(): AutoSyncConfig {
    return this.store.getConfig()?.autoSync ?? DEFAULT_AUTO_SYNC;
  }

  private autoSyncDelayMs(autoSync: AutoSyncConfig): number {
    return Math.max(1, autoSync.delayMinutes) * 60_000;
  }

  private clearCommitTimer(): void {
    this.eventSyncArmed = false;
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = undefined;
    }
  }

  /** Re-derive if the local date has moved on. `today` is only recomputed when the
   *  state is derived, so without this a tab left open overnight keeps yesterday's
   *  date: nothing would become overdue, a recurring task due the next day would
   *  never move into the day view, and the day view would go on calling yesterday
   *  "today".
   *
   *  Comparing the date rather than trusting whatever woke us is what lets every
   *  trigger share one path: the timer below, coming back to the tab, refocusing
   *  the window. Each is unreliable on its own and none of them has to be right —
   *  a check that finds the same date is free. */
  private checkDateRollover = (): void => {
    if (this.loaded && this.snapshot.data && this.snapshot.data.today !== today()) {
      this.updateSnapshot({ data: this.deriveState() });
    }
    this.scheduleDateRollover();
  };

  /** Fire the check just after the next local midnight — the case where the app is
   *  open in front of someone as the day turns, and nothing else would run.
   *
   *  Not sufficient by itself, which is why `checkDateRollover` has the other two
   *  triggers: a backgrounded tab can be frozen outright (no JS runs until you come
   *  back to it), and a sleeping machine fires this late or not at all. Precisely
   *  the overnight case this exists for. */
  private scheduleDateRollover(): void {
    this.clearRolloverTimer();
    const now = new Date();
    // 30s past midnight, so a timer firing a touch early still lands on the new day.
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 30);
    this.rolloverTimer = setTimeout(this.checkDateRollover, Math.max(1_000, nextMidnight.getTime() - now.getTime()));
  }

  /** Coming back to the tab is the moment the date is most likely to be stale, and
   *  the moment it matters — it is when someone looks at the app again. */
  private onTabVisible = (): void => {
    if (document.visibilityState === 'visible') {
      this.checkDateRollover();
    }
  };

  private clearRolloverTimer(): void {
    if (this.rolloverTimer) {
      clearTimeout(this.rolloverTimer);
      this.rolloverTimer = undefined;
    }
  }

  /** Debounce a write of the dirty files to IndexedDB. Runs regardless of the
   *  auto-sync setting — this is crash/close recovery, not a commit. */
  private schedulePersist(): void {
    this.clearPersistTimer();
    this.persistTimer = setTimeout(() => void this.persistNow(), PERSIST_DEBOUNCE_MS);
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
    await savePending(snapshotOf(this.fm, this.repo, this.repoKey(), Date.now()));
  }
}

// Singleton — the whole app shares one store (one repo mounted at a time).
export const worklogStore = new WorklogStore();
