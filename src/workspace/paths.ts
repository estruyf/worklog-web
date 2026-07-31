// The "filesystem" the rest of the app writes through: an in-memory map of
// repo-relative paths loaded from GitHub, with dirty-tracking so the host can
// commit only the files that changed. Services (`services/*`, `commands/shared`)
// go through the `readText / writeText / ensureDir` free functions and the
// `Workspace` path helpers; a path is always a plain repo-relative string.

import type { AutoSyncConfig, Client, DaylogConfig, StatusDef, TaskLink } from '../model/types';
import { DEFAULT_STATUSES } from '../model/status';

export const DEFAULT_HOURS_PER_DAY = 8;
export const DEFAULT_WEEK_START = 0; // Sunday
export const DEFAULT_TODOS_PER_PAGE = 5;
export const DEFAULT_AUTO_SYNC: AutoSyncConfig = { enabled: false, delayMinutes: 5 };

/** Normalize a config `todosPerPage` to a whole number of at least 1, falling
 *  back to the default for missing/invalid values. */
export function parseTodosPerPage(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : DEFAULT_TODOS_PER_PAGE;
}

/** Normalize a config `autoSync` block, clamping the delay to a sane minimum and
 *  falling back to the defaults for missing/invalid fields. */
export function parseAutoSync(value: unknown): AutoSyncConfig {
  const raw = (value ?? {}) as Partial<AutoSyncConfig>;
  const delay =
    typeof raw.delayMinutes === 'number' && Number.isFinite(raw.delayMinutes) && raw.delayMinutes >= 1
      ? raw.delayMinutes
      : DEFAULT_AUTO_SYNC.delayMinutes;
  return { enabled: raw.enabled === true, delayMinutes: delay };
}

/** Normalize reference links from anywhere they arrive as loose data — config
 *  json, a form, a bare url string — into the model's shape. Entries without a
 *  usable url are dropped, and a blank label is left off rather than stored as
 *  '', so `link.label` is absent exactly when there isn't one. */
export function parseLinks(value: unknown): TaskLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((l) => (typeof l === 'string' ? { url: l } : (l as Partial<TaskLink> | null)))
    .filter((l): l is Partial<TaskLink> => !!l && typeof l.url === 'string' && !!l.url.trim())
    .map((l) => {
      const label = typeof l.label === 'string' ? l.label.trim() : '';
      return { url: l.url!.trim(), ...(label ? { label } : {}) };
    });
}

/** A client's links as config.json holds them: the key is dropped entirely when
 *  none survive, so the file stays free of empty arrays for the clients that
 *  never got any. */
export function parseClientLinks(value: unknown): TaskLink[] | undefined {
  const links = parseLinks(value);
  return links.length ? links : undefined;
}

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

/** The mutable, in-memory repository contents backing the services. One
 *  repo is "mounted" at a time via {@link mountFileMap}. */
export class FileMap {
  /** repo-relative path -> UTF-8 text (markdown, json). */
  readonly text = new Map<string, string>();
  /** repo-relative path -> bytes (images under assets/). */
  readonly binary = new Map<string, Uint8Array>();
  /** Paths written since load; the host commits exactly these. */
  readonly dirty = new Set<string>();
  /** Dirty paths that were removed rather than written; they commit as tree
   *  deletions instead of blobs. */
  readonly deleted = new Set<string>();
  /** Paths the branch is known to hold — everything loaded, plus everything a
   *  successful sync wrote. A delete only has to reach GitHub for those. */
  readonly remote = new Set<string>();

  /** Blob SHA per path as loaded from GitHub, to skip unchanged files on reload. */
  readonly baseSha = new Map<string, string>();

  /** Text of each path as the branch last had it — the version the local edits
   *  started from. It's the common ancestor the sync merge needs to tell "I
   *  changed this" from "the other instance changed this" (see data/merge). Set
   *  on load and updated on every successful push. */
  readonly baseText = new Map<string, string>();

  markDirty(path: string): void {
    this.dirty.add(path);
  }
  clearDirty(): void {
    this.dirty.clear();
  }
}

let mounted: FileMap | undefined;

/** Mount the file map the services read/write against. */
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

// ---- Free functions the services import ----------------------------------
// A "uri" here is simply a repo-relative path string.

export async function readText(path: string): Promise<string | undefined> {
  return fileMap().text.get(path);
}

export async function writeText(path: string, text: string): Promise<void> {
  const fm = fileMap();
  fm.deleted.delete(path); // re-creating a deleted path cancels the deletion
  fm.text.set(path, text);
  fm.markDirty(path);
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  const fm = fileMap();
  fm.deleted.delete(path);
  fm.binary.set(path, bytes);
  fm.markDirty(path);
}

/** Remove a file. It commits as a tree deletion when the branch actually holds
 *  it; a file that only ever existed locally is just dropped from the pending set. */
export async function deleteFile(path: string): Promise<void> {
  removeFileFrom(fileMap(), path);
}

/** `deleteFile` against a map named outright, for the data layer — it holds the
 *  map it is rebuilding and shouldn't have to route through the mount to edit it. */
export function removeFileFrom(fm: FileMap, path: string): void {
  fm.text.delete(path);
  fm.binary.delete(path);
  if (fm.remote.has(path)) {
    fm.deleted.add(path);
    fm.markDirty(path);
  } else {
    fm.deleted.delete(path);
    fm.dirty.delete(path);
  }
}

/** Every text path currently in the map, for services that work on a folder
 *  (there are no directories to list — the map is flat). */
export function listTextPaths(): string[] {
  return [...fileMap().text.keys()];
}

/** Directories are implicit in the flat map — nothing to create. Kept so call
 *  sites can stay symmetrical with a real filesystem. */
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
      return { hoursPerDay: DEFAULT_HOURS_PER_DAY, weekStart: DEFAULT_WEEK_START, todosPerPage: DEFAULT_TODOS_PER_PAGE, clients: [], statuses: DEFAULT_STATUSES, autoSync: { ...DEFAULT_AUTO_SYNC } };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<DaylogConfig>;
      const statuses = Array.isArray(parsed.statuses)
        ? parsed.statuses.filter((s): s is StatusDef => !!s && !!s.id && !!s.label)
        : [];
      return {
        hoursPerDay: parsed.hoursPerDay && parsed.hoursPerDay > 0 ? parsed.hoursPerDay : DEFAULT_HOURS_PER_DAY,
        weekStart: parseWeekStart(parsed.weekStart),
        todosPerPage: parseTodosPerPage(parsed.todosPerPage),
        // `archived`, `description` and `links` are normalized to value-or-absent
        // so they never round-trip a stray value into config.json (JSON.stringify
        // drops the undefined).
        clients: Array.isArray(parsed.clients)
          ? parsed.clients
              .filter((c): c is Client => !!c && !!c.id)
              .map((c) => ({
                ...c,
                description: typeof c.description === 'string' && c.description.trim() ? c.description : undefined,
                links: parseClientLinks(c.links),
                archived: c.archived === true ? true : undefined,
              }))
          : [],
        statuses: statuses.length ? statuses : DEFAULT_STATUSES,
        autoSync: parseAutoSync(parsed.autoSync),
      };
    } catch {
      return { hoursPerDay: DEFAULT_HOURS_PER_DAY, weekStart: DEFAULT_WEEK_START, todosPerPage: DEFAULT_TODOS_PER_PAGE, clients: [], statuses: DEFAULT_STATUSES, autoSync: { ...DEFAULT_AUTO_SYNC } };
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
