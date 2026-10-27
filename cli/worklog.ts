// The `worklog` CLI (published as @estruyf/worklog-cli, bundled by build:cli):
// log work on a task, add a to-do, change or close a task, straight into a local
// clone of the timesheet repo and push it, so the online app shows it on its next
// load; set the hours worked on a day; or list the open tasks. It talks to GitHub only through `git` and the
// user's own credentials — the site and its OAuth session are not involved.
//
//   worklog log --client icefire --title "Fix the picker" \
//     --link https://github.com/owner/repo/issues/12 --note "Widened the tap targets"
//
//   worklog add --client icefire --title "Email the client" --due 2026-11-13 \
//     --priority high --description "About the session and the roundtable"
//
//   worklog update --id t_469p6i --due 2026-11-20
//   worklog done --title "Email the client"
//   worklog list --due-by 2026-11-30 --json
//   worklog hours --client icefire --hours 4 --note "Picker fixes"
//
// Every edit goes through src/services, i.e. the app's own parser and services,
// so the Markdown round-trips exactly as if it was made in the app.
// A lost push race is never merged by git: the clone is reset to the remote and
// the (idempotent) edit replayed, so conflict markers can't reach the Markdown.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { Store } from '../src/store';
import type { Task } from '../src/model/types';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { isWorklogPath } from '../src/server/github';
import { logWork, type LogWorkInput, type LogWorkResult } from '../src/services/logWork';
import { addTask, type AddTaskResult } from '../src/services/addTask';
import { closeTask, editTask, type CloseTaskResult, type EditTaskResult, type TaskRef } from '../src/services/editTask';
import { listTasks } from '../src/services/listTasks';
import { dayEntries, logHours, targetLabel, type LogHoursResult } from '../src/services/logHours';
import { EVENT_TYPES } from '../src/model/worklog';
import { PRIORITIES } from '../src/model/priority';
import { GENERAL_TODO_CLIENT_ID } from '../src/model/todos';
import { isValidISODate, today } from '../src/util/date';

const TEXT_PATH = /\.(md|json)$|\.worklog$/;
const PUSH_ATTEMPTS = 3;
/** The value that clears an optional field: `--due none`, `--parent none`. */
const NONE = 'none';

const USAGE = `Usage: worklog <command> [options]

  log     Work that was done: marks the day worked on a task (creating the task
          when it's new) and adds the note.
  add     Something still to do: creates an open task. No day is marked worked.
          Without --client it goes on the general to-do list.
  update  Changes an existing task: due date, priority, description, ...
  done    Closes a task. A recurring one rolls on to its next occurrence.
  list    Prints the open tasks. Read-only.
  hours   Sets the hours worked for a client (or a day event) on a day. Without
          --hours it prints what's logged that day.

All but list, and hours without --hours, commit and push to your timesheet repo.

Every command:
  --repo <path>         timesheet clone (default: $WORKLOG_REPO)
  --client <id>         client id from .worklog/config.json; "todos" is the
                        general to-do list

Naming a task (log, update, done):
  --id <t_xxxxxx>       this exact task
  --link <url>          the task linked to this issue/ticket url
  --title <title>       the open task with this title

log --client <id> --title <title>:
  --note <text>         progress note added to the task
  --date <date>         day worked, YYYY-MM-DD (default: today)

add --title <title>:
  --link <url>          issue/ticket url
  --due <date>          day the task is due, YYYY-MM-DD
  --priority <level>    ${PRIORITIES.map((p) => p.id).join(', ')}
  --description <text>  what the task is about
  --tag <tag>           repeat for several tags
  --parent <t_xxxxxx>   make it a subtask of this task

update:
  --rename <title>      new title
  --due <date|none>     new due date, or none to clear it
  --priority <level>    new priority; normal clears it
  --description <text>  new description; "" clears it
  --status <id>         a status from .worklog/config.json
  --tag <tag>           add a tag (repeatable)
  --untag <tag>         remove a tag (repeatable)
  --parent <id|none>    move it under this task, or none to make it top-level

hours --client <id> | --event <type>:
  --hours <amount>      full, half, or a number of hours; 0 removes the entry.
                        Sets the day's total for that client, it doesn't add
  --date <date>         the day, YYYY-MM-DD (default: today)
  --note <text>         what the time went to (default: keep the note there)
  --event <type>        ${EVENT_TYPES.map((e) => e.id).join(', ')}

list:
  --due-by <date>       only tasks due on or before this day
  --tag <tag>           only tasks with this tag
  --json                print JSON instead of one line per task

log, add, update, done, hours:
  --dry-run             show the change, commit nothing`;

/** The options each command takes, beyond --repo and --help. Anything else is
 *  refused — so a to-do's due date can't silently end up as a day worked, or a
 *  day worked as a due date. */
const OPTIONS: Record<string, string[]> = {
  log: ['client', 'id', 'link', 'title', 'note', 'date', 'dry-run'],
  add: ['client', 'link', 'title', 'due', 'priority', 'description', 'tag', 'parent', 'dry-run'],
  update: [
    'client', 'id', 'link', 'title', 'rename', 'due', 'priority', 'description',
    'status', 'tag', 'untag', 'parent', 'dry-run',
  ],
  done: ['client', 'id', 'link', 'title', 'dry-run'],
  list: ['client', 'due-by', 'tag', 'json'],
  hours: ['client', 'event', 'hours', 'date', 'note', 'dry-run'],
};

/** Where a misplaced option probably meant to go. */
const HINTS: Record<string, string> = {
  date: 'A to-do\'s date is --due; --date is the day worked, for "worklog log" and "worklog hours".',
  due: 'The day worked is --date; --due is when a to-do is due.',
};

/** What the edit did, and the line that says so (before the outcome). */
type Edit = (store: Store) => Promise<string>;

type Values = Record<string, string | string[] | boolean | undefined>;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      client: { type: 'string' },
      title: { type: 'string' },
      link: { type: 'string' },
      id: { type: 'string' },
      note: { type: 'string' },
      date: { type: 'string' },
      due: { type: 'string' },
      'due-by': { type: 'string' },
      priority: { type: 'string' },
      description: { type: 'string' },
      rename: { type: 'string' },
      status: { type: 'string' },
      tag: { type: 'string', multiple: true },
      untag: { type: 'string', multiple: true },
      parent: { type: 'string' },
      event: { type: 'string' },
      hours: { type: 'string' },
      json: { type: 'boolean' },
      repo: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    return;
  }
  const command = positionals[0];
  if (!(command in OPTIONS) || positionals.length > 1) {
    throw new Error(`Unknown command "${positionals.join(' ')}".\n\n${USAGE}`);
  }
  const allowed = new Set([...OPTIONS[command], 'repo', 'help']);
  const misplaced = Object.keys(values).find((o) => !allowed.has(o));
  if (misplaced) {
    const hint = HINTS[misplaced] ? ` ${HINTS[misplaced]}` : '';
    throw new Error(`"worklog ${command}" has no --${misplaced} option.${hint}\n\n${USAGE}`);
  }
  validate(values);
  const repo = values.repo ?? process.env.WORKLOG_REPO;
  if (!repo) {
    throw new Error('Point --repo or $WORKLOG_REPO at a clone of your timesheet repo.');
  }
  if (command === 'list') {
    return list(repo, values);
  }
  if (command === 'hours' && values.hours === undefined) {
    return showDay(repo, (values.date as string | undefined) ?? today());
  }
  return run(repo, toEdit(command, values), !!values['dry-run']);
}

function validate(values: Values): void {
  for (const option of ['date', 'due', 'due-by']) {
    const value = values[option];
    if (typeof value === 'string' && !(option === 'due' && value === NONE) && !isValidISODate(value)) {
      throw new Error(`--${option} must be YYYY-MM-DD, got "${value}".`);
    }
  }
  const priority = values.priority;
  if (typeof priority === 'string' && !PRIORITIES.some((p) => p.id === priority.trim().toLowerCase())) {
    throw new Error(`--priority must be one of ${PRIORITIES.map((p) => p.id).join(', ')}, got "${priority}".`);
  }
}

function toEdit(command: string, values: Values): Edit {
  const str = (key: string) => values[key] as string | undefined;
  const list = (key: string) => values[key] as string[] | undefined;
  const ref: TaskRef = { taskId: str('id'), link: str('link'), title: str('title'), clientId: str('client') };
  const orNull = (value: string | undefined) => (value === NONE ? null : value);

  switch (command) {
    case 'log': {
      const clientId = str('client');
      const title = str('title');
      if (!clientId || !title) {
        throw new Error(`--client and --title are required.\n\n${USAGE}`);
      }
      const input: LogWorkInput = { clientId, title, taskId: ref.taskId, link: ref.link, note: str('note'), date: str('date') };
      return async (store) => describeLog(await logWork(store, input), input);
    }
    case 'add': {
      const title = str('title');
      if (!title) {
        throw new Error(`--title is required.\n\n${USAGE}`);
      }
      // A to-do needs no client: without one it lands on the general to-do list.
      const input = {
        clientId: str('client') ?? GENERAL_TODO_CLIENT_ID,
        title,
        link: ref.link,
        due: str('due'),
        priority: str('priority'),
        description: str('description'),
        tags: list('tag'),
        parentId: str('parent'),
      };
      return async (store) => describeAdd(await addTask(store, input));
    }
    case 'update': {
      requireRef(ref);
      const edit = {
        title: str('rename'),
        due: orNull(str('due')),
        priority: str('priority'),
        description: str('description'),
        status: str('status'),
        addTags: list('tag'),
        removeTags: list('untag'),
        parentId: orNull(str('parent')),
      };
      if (Object.values(edit).every((v) => v === undefined)) {
        throw new Error(`Nothing to change: pass at least one of --rename, --due, --priority, --description, --status, --tag, --untag, --parent.`);
      }
      return async (store) => describeUpdate(await editTask(store, ref, edit));
    }
    case 'hours': {
      const input = { clientId: str('client'), event: str('event'), hours: str('hours') ?? '', note: str('note'), date: str('date') };
      return async (store) => describeHours(store, await logHours(store, input));
    }
    default: {
      requireRef(ref);
      return async (store) => describeDone(await closeTask(store, ref));
    }
  }
}

function requireRef(ref: TaskRef): void {
  if (!ref.taskId && !ref.link && !ref.title) {
    throw new Error(`Name the task with --id, --link or --title.\n\n${USAGE}`);
  }
}

async function run(repo: string, edit: Edit, dryRun: boolean): Promise<void> {
  const git = gitIn(repo);

  // The reset below throws away local state, so it may only ever throw away our
  // own commit: refuse a clone with uncommitted edits or unpushed commits.
  if (git('status', '--porcelain', '--untracked-files=no')) {
    throw new Error(`${repo} has uncommitted changes; commit or discard them first.`);
  }
  git('fetch', '--quiet');
  if (git('rev-list', '--count', '@{u}..HEAD') !== '0') {
    throw new Error(`${repo} has unpushed commits; push them first.`);
  }
  git('merge', '--ff-only', '--quiet', '@{u}');

  for (let attempt = 1; ; attempt++) {
    const { line, changed } = await applyToClone(repo, edit);
    if (changed.length === 0) {
      console.log(`${line} — nothing new to write`);
      return;
    }
    if (dryRun) {
      // Intent-to-add, so a client file the edit created shows in the diff too.
      git('add', '--intent-to-add', '--', ...changed);
      console.log(git('--no-pager', 'diff', '--', ...changed));
      git('reset', '--quiet', '--hard', 'HEAD');
      console.log(`${line} — dry run, nothing committed`);
      return;
    }
    git('add', '--', ...changed);
    git('commit', '--quiet', '-m', `chore: worklog sync ${today()}`);
    try {
      git('push', '--quiet');
      console.log(`${line} — pushed ${git('rev-parse', '--short', 'HEAD')}`);
      return;
    } catch (err) {
      git('reset', '--quiet', '--hard', '@{u}');
      const raced = /rejected|fetch first|non-fast-forward/.test(String((err as { stderr?: string }).stderr));
      if (!raced) {
        throw new Error('Push failed; nothing was written.', { cause: err });
      }
      if (attempt >= PUSH_ATTEMPTS) {
        throw new Error(`Push rejected ${PUSH_ATTEMPTS} times; nothing was written.`, { cause: err });
      }
      // Someone (the app) pushed in between. Start over from their commit.
      git('fetch', '--quiet');
      git('reset', '--quiet', '--hard', '@{u}');
    }
  }
}

/** Read-only commands catch up with the remote when that's safe. A clone with
 *  the user's own edits in it is read as it is, with a warning. */
function catchUp(repo: string): void {
  const git = gitIn(repo);
  try {
    git('fetch', '--quiet');
    if (git('status', '--porcelain', '--untracked-files=no') || git('rev-list', '--count', '@{u}..HEAD') !== '0') {
      console.error(`${repo} has local changes; reading it as it is, without the latest from the remote.`);
    } else {
      git('merge', '--ff-only', '--quiet', '@{u}');
    }
  } catch {
    console.error('Could not fetch the remote; reading the clone as it is.');
  }
}

async function list(repo: string, values: Values): Promise<void> {
  catchUp(repo);
  const { store } = await loadClone(repo);
  const tasks = listTasks(store, {
    clientId: values.client as string | undefined,
    dueBy: values['due-by'] as string | undefined,
    tag: (values.tag as string[] | undefined)?.[0],
  });
  if (values.json) {
    console.log(JSON.stringify(tasks.map(toJson), null, 2));
    return;
  }
  if (tasks.length === 0) {
    console.log('No open tasks match.');
    return;
  }
  for (const t of tasks) {
    console.log(
      [t.id, t.due ?? '-', t.priority ?? '-', t.clientIds[0], t.status, t.title].join('\t'),
    );
  }
}

async function showDay(repo: string, date: string): Promise<void> {
  catchUp(repo);
  const { store } = await loadClone(repo);
  const entries = dayEntries(store, date);
  const total = entries.reduce((sum, e) => sum + e.hours, 0);
  console.log(`${date}: ${total}h logged of ${store.getConfig().hoursPerDay}h`);
  for (const e of entries) {
    console.log(['', e.clientId, `${e.hours}h`, targetLabel(store, e.clientId), e.note ?? ''].join('\t').trimEnd());
  }
}

function toJson(t: Task) {
  return {
    id: t.id,
    title: t.title,
    client: t.clientIds[0],
    status: t.status,
    priority: t.priority ?? 'normal',
    due: t.due ?? null,
    tags: t.tags ?? [],
    links: t.links.map((l) => l.url),
    parent: t.parentId ?? null,
    repeats: !!t.repeat,
    created: t.created ?? null,
    description: t.description ?? null,
    file: t.sourceFile,
  };
}

function gitIn(repo: string) {
  // stderr is captured rather than inherited: a failure carries it in its message,
  // and a push race the loop recovers from stays quiet.
  return (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** The clone's Worklog files in a fresh file map, parsed into a store. */
async function loadClone(repo: string): Promise<{ store: Store; fm: FileMap }> {
  const fm = new FileMap();
  for (const path of listFiles(repo)) {
    if (isWorklogPath(path) && TEXT_PATH.test(path)) {
      fm.text.set(path, readFileSync(join(repo, path), 'utf8'));
      fm.remote.add(path);
    }
  }
  mountFileMap(fm);
  const store = new Store();
  await store.rebuild('load');
  return { store, fm };
}

/** Run the edit on the clone and write back the files whose text changed. A
 *  service may rewrite a file with what it already said, which is no change to
 *  commit. */
async function applyToClone(repo: string, edit: Edit): Promise<{ line: string; changed: string[] }> {
  const { store, fm } = await loadClone(repo);
  const before = new Map(fm.text);
  const line = await edit(store);
  const changed = [...fm.dirty].filter((path) => fm.text.has(path) && fm.text.get(path) !== before.get(path));
  for (const path of changed) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), fm.text.get(path) ?? '');
  }
  return { line, changed };
}

function listFiles(repo: string): string[] {
  return readdirSync(repo, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(repo, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((path) => !path.startsWith('.git/'));
}

function label(task: Task): string {
  return `${task.id} "${task.title}" (${task.sourceFile})`;
}

function describeLog({ task, created, markedWorked, noteAdded }: LogWorkResult, input: LogWorkInput): string {
  const what = [
    created ? 'created' : 'found',
    markedWorked ? `marked worked ${input.date ?? today()}` : undefined,
    noteAdded ? 'note added' : undefined,
  ].filter(Boolean);
  return `${label(task)}: ${what.join(', ')}`;
}

function describeAdd({ task, created }: AddTaskResult): string {
  const what = [
    created ? 'created' : 'already exists, left as is',
    task.due ? `due ${task.due}` : undefined,
    task.priority ? `priority ${task.priority}` : undefined,
  ].filter(Boolean);
  return `${label(task)}: ${what.join(', ')}`;
}

function describeUpdate({ task, changed }: EditTaskResult): string {
  return `${label(task)}: ${changed.length ? `changed ${changed.join(', ')}` : 'already up to date'}`;
}

function describeHours(store: Store, r: LogHoursResult): string {
  const was = !r.previous ? 'new' : r.previous.hours === r.hours && r.changed ? 'note updated' : `was ${r.previous.hours}h`;
  const what = r.hours > 0 ? `${r.hours}h (${was})` : r.previous ? `removed (was ${r.previous.hours}h)` : 'nothing logged';
  return `${targetLabel(store, r.target)} on ${r.date}: ${what}; day total ${r.dayTotal}h of ${r.hoursPerDay}h`;
}

function describeDone({ task, closed }: CloseTaskResult): string {
  if (!closed) {
    return `${label(task)}: ${task.completed ? `already closed on ${task.completed}` : `already done today, next due ${task.due}`}`;
  }
  // A recurring task isn't closed: it rolls on to its next occurrence.
  return `${label(task)}: ${task.completed ? 'closed' : `done, next due ${task.due}`}`;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
