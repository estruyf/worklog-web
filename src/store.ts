// Browser replacement for the extension's `Store`. Owns the in-memory db and the
// Workspace, runs rebuilds (re-parse the file map), and exposes the same surface
// the ported services use: `store.db`, `store.ws`, `store.getConfig()`,
// `store.rebuild()`. `onDidChange` lets the host re-derive the snapshot and the
// dirty-file committer arm its debounce after every persisted edit.

import { MemoryDb } from './db/memoryDb';
import { rebuild } from './workspace/indexer';
import { Workspace } from './workspace/paths';
import type { DaylogConfig } from './model/types';

type Listener = () => void;

export class Store {
  readonly db = new MemoryDb();
  readonly ws = new Workspace();
  private config!: DaylogConfig;
  private readonly listeners = new Set<Listener>();

  /** Rebuild from the mounted file map (called once after load, then after each edit). */
  async rebuild(_reason: string): Promise<void> {
    this.config = await this.ws.loadConfig();
    await rebuild(this.db, this.ws);
    this.emitChange();
  }

  getConfig(): DaylogConfig {
    return this.config;
  }

  onDidChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    for (const l of this.listeners) {
      l();
    }
  }
}
