// The domain store. Owns the in-memory db and the Workspace, runs rebuilds
// (re-parse the file map), and exposes the surface the services use: `store.db`,
// `store.ws`, `store.getConfig()`, `store.rebuild()`. `onDidChange` lets the data
// layer (worklogStore) re-derive app state and arm its debounced committer after
// every persisted edit.

import { MemoryDb } from './db/memoryDb';
import { rebuild } from './workspace/indexer';
import { Workspace } from './workspace/paths';
import type { DaylogConfig } from './model/types';

/** The reason is the name the caller gave the change ("addTask", "setStatus", …).
 *  `model/syncEvents` maps it to the event auto-sync reacts to, which is why the
 *  strings are part of the contract and not just a debugging aid. */
type Listener = (reason: string) => void;

export class Store {
  readonly db = new MemoryDb();
  readonly ws = new Workspace();
  private config!: DaylogConfig;
  private readonly listeners = new Set<Listener>();

  /** Rebuild from the mounted file map (called once after load, then after each edit). */
  async rebuild(reason: string): Promise<void> {
    this.config = await this.ws.loadConfig();
    await rebuild(this.db, this.ws);
    this.emitChange(reason);
  }

  getConfig(): DaylogConfig {
    return this.config;
  }

  onDidChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(reason: string): void {
    for (const l of this.listeners) {
      l(reason);
    }
  }
}
