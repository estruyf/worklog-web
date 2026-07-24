// Browser/Workers replacement for the extension's VS Code `workspace/paths.ts`.
//
// The extension backed file I/O with `vscode.workspace.fs` over disk URIs. Here
// the "filesystem" is an in-memory map of repo-relative paths loaded from GitHub,
// with dirty-tracking so the host can commit only the files that changed. The
// ported services (`services/*`, `commands/shared`) call the same `readText /
// writeText / ensureDir` free functions and the same `Workspace` path helpers,
// so they need no changes beyond treating a "Uri" as a plain path string.

import { Client, DaylogConfig, StatusDef } from '../model/types';
import { DEFAULT_STATUSES } from '../model/status';

export const DEFAULT_HOURS_PER_DAY = 8;
export const DEFAULT_WEEK_START = 0; // Sunday

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Normalize a config `weekStart` (a 0–6 index or a day name like "monday") to a
 *  0–6 index, falling back to Sunday when unset or unrecognized. */
export function parseWeekStart(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === 'string') {
    const idx = DAY_NAMES.indexOf(value.trim().toLowerCase());
    if (idx >= 0) {
      return idx;
    }
  }
  return DEFAULT_WEEK_START;
}

// ---- In-memory file map --------------------------------------------------

/** The mutable, in-memory repository contents backing the ported services. One
 *  repo is "mounted" at a time via {@link mountFileMap}. */
export class FileMap {
  /** repo-relative path -> UTF-8 text (markdown, json). */
  readonly text = new Map<string, string>();
  /** repo-relative path -> bytes (images under assets/). */
  readonly binary = new Map<string, Uint8Array>();
  /** Paths written since load; the host commits exactly these. */
  readonly dirty = new Set<string>();

  /** Blob SHA per path as loaded from GitHub, to skip unchanged files on reload. */
  readonly baseSha = new Map<string, string>();

  markDirty(path: string): void {
    this.dirty.add(path);
  }
  clearDirty(): void {
    this.dirty.clear();
  }
}

let mounted: FileMap | undefined;

/** Mount the file map the ported services read/write against. */
export function mountFileMap(map: FileMap): void {
  mounted = map;
}

/** The currently mounted file map (throws if none — a programming error). */
export function fileMap(): FileMap {
  if (!mounted) {
    throw new Error('No repository is mounted.');
  }
  return mounted;
}

// ---- Free functions the ported services import ---------------------------
// In the extension these took a `vscode.Uri`; here a "uri" is a repo-relative
// path string, so the call sites are unchanged apart from dropping `.fsPath`.

export async function readText(path: string): Promise<string | undefined> {
  return fileMap().text.get(path);
}

export async function writeText(path: string, text: string): Promise<void> {
  const fm = fileMap();
  fm.text.set(path, text);
  fm.markDirty(path);
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  const fm = fileMap();
  fm.binary.set(path, bytes);
  fm.markDirty(path);
}

/** Directories are implicit in the flat map — nothing to create. Kept so the
 *  ported services can call it exactly as before. */
export async function ensureDir(_path: string): Promise<void> {
  // no-op
}

// ---- Workspace layout (paths are repo-relative strings) ------------------

export class Workspace {
  get configDir(): string {
    return '.worklog';
  }
  get configFile(): string {
    return '.worklog/config.json';
  }
  get clientsDir(): string {
    return 'clients';
  }
  get archiveDir(): string {
    return 'archive';
  }
  get worklogDir(): string {
    return 'worklog';
  }
  get assetsDir(): string {
    return 'assets';
  }
  get appFile(): string {
    return 'worklog.worklog';
  }

  clientFile(clientId: string): string {
    return `clients/${clientId}.md`;
  }
  archiveFile(clientId: string, month: string): string {
    return `archive/${clientId}/${month}.md`;
  }
  worklogFile(month: string): string {
    return `worklog/${month}.md`;
  }

  async loadConfig(): Promise<DaylogConfig> {
    const raw = await readText(this.configFile);
    if (raw === undefined) {
      return { hoursPerDay: DEFAULT_HOURS_PER_DAY, weekStart: DEFAULT_WEEK_START, clients: [], statuses: DEFAULT_STATUSES };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<DaylogConfig>;
      const statuses = Array.isArray(parsed.statuses)
        ? parsed.statuses.filter((s): s is StatusDef => !!s && !!s.id && !!s.label)
        : [];
      return {
        hoursPerDay: parsed.hoursPerDay && parsed.hoursPerDay > 0 ? parsed.hoursPerDay : DEFAULT_HOURS_PER_DAY,
        weekStart: parseWeekStart(parsed.weekStart),
        clients: Array.isArray(parsed.clients) ? parsed.clients.filter((c): c is Client => !!c && !!c.id) : [],
        statuses: statuses.length ? statuses : DEFAULT_STATUSES,
      };
    } catch {
      return { hoursPerDay: DEFAULT_HOURS_PER_DAY, weekStart: DEFAULT_WEEK_START, clients: [], statuses: DEFAULT_STATUSES };
    }
  }

  async saveConfig(config: DaylogConfig): Promise<void> {
    await writeText(this.configFile, JSON.stringify(config, null, 2) + '\n');
  }
}

/** basename without extension, for deriving a client id from a path. */
export function stem(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.[^.]+$/, '');
}

/** the directory name of a path (parent folder). */
export function dirName(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.pop() ?? '';
}
