// The `worklog` CLI (published as @estruyf/worklog-cli, bundled by build:cli):
// log work on a task straight into a local clone of the timesheet repo and push
// it, so the online app shows it on its next load. It talks to GitHub only
// through `git` and the user's own credentials — the site and its OAuth session
// are not involved.
//
//   worklog log --client icefire --title "Fix the picker" \
//     --link https://github.com/owner/repo/issues/12 --note "Widened the tap targets"
//
// The edit goes through src/services/logWork, i.e. the app's own parser and
// services, so the Markdown round-trips exactly as if it was made in the app.
// A lost push race is never merged by git: the clone is reset to the remote and
// the (idempotent) edit replayed, so conflict markers can't reach the Markdown.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { isWorklogPath } from '../src/server/github';
import { logWork, type LogWorkInput, type LogWorkResult } from '../src/services/logWork';
import { isValidISODate, today } from '../src/util/date';

const TEXT_PATH = /\.(md|json)$|\.worklog$/;
const PUSH_ATTEMPTS = 3;

const USAGE = `Usage: worklog log --client <id> --title <title> [options]

Marks the day worked on a task in your timesheet repo (creating the task when
it's new), adds the note, then commits and pushes.

  --client <id>     client id from .worklog/config.json (required)
  --title <title>   task title; used to create the task, or to find an open one (required)
  --link <url>      issue/ticket url — finds the task again on later runs
  --id <t_xxxxxx>   log on this exact task
  --note <text>     progress note added to the task
  --date <date>     day worked, YYYY-MM-DD (default: today)
  --repo <path>     timesheet clone (default: $WORKLOG_REPO)
  --dry-run         show the change, commit nothing`;

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
      repo: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    return;
  }
  if (positionals[0] !== 'log' || positionals.length > 1) {
    throw new Error(`Unknown command "${positionals.join(' ')}".\n\n${USAGE}`);
  }
  if (!values.client || !values.title) {
    throw new Error(`--client and --title are required.\n\n${USAGE}`);
  }
  if (values.date && !isValidISODate(values.date)) {
    throw new Error(`--date must be YYYY-MM-DD, got "${values.date}".`);
  }
  const input: LogWorkInput = {
    clientId: values.client,
    title: values.title,
    taskId: values.id,
    link: values.link,
    note: values.note,
    date: values.date,
  };
  const repo = values.repo ?? process.env.WORKLOG_REPO;
  if (!repo) {
    throw new Error('Point --repo or $WORKLOG_REPO at a clone of your timesheet repo.');
  }
  return run(repo, input, !!values['dry-run']);
}

async function run(repo: string, input: LogWorkInput, dryRun: boolean): Promise<void> {
  // stderr is captured rather than inherited: a failure carries it in its message,
  // and a push race the loop recovers from stays quiet.
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

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
    const { result, changed } = await applyToClone(repo, input);
    if (changed.length === 0) {
      console.log(describe(result, input, 'nothing new to log'));
      return;
    }
    if (dryRun) {
      // Intent-to-add, so a client file the edit created shows in the diff too.
      git('add', '--intent-to-add', '--', ...changed);
      console.log(git('--no-pager', 'diff', '--', ...changed));
      git('reset', '--quiet', '--hard', 'HEAD');
      console.log(describe(result, input, 'dry run, nothing committed'));
      return;
    }
    git('add', '--', ...changed);
    git('commit', '--quiet', '-m', `chore: worklog sync ${today()}`);
    try {
      git('push', '--quiet');
      console.log(describe(result, input, `pushed ${git('rev-parse', '--short', 'HEAD')}`));
      return;
    } catch (err) {
      git('reset', '--quiet', '--hard', '@{u}');
      const raced = /rejected|fetch first|non-fast-forward/.test(String((err as { stderr?: string }).stderr));
      if (!raced) {
        throw new Error('Push failed; nothing was logged.', { cause: err });
      }
      if (attempt >= PUSH_ATTEMPTS) {
        throw new Error(`Push rejected ${PUSH_ATTEMPTS} times; nothing was logged.`, { cause: err });
      }
      // Someone (the app) pushed in between. Start over from their commit.
      git('fetch', '--quiet');
      git('reset', '--quiet', '--hard', '@{u}');
    }
  }
}

/** Load the clone into a fresh file map, run the edit, write back what changed. */
async function applyToClone(repo: string, input: LogWorkInput): Promise<{ result: LogWorkResult; changed: string[] }> {
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

  const result = await logWork(store, input);
  const changed = [...fm.dirty].filter((path) => fm.text.has(path));
  for (const path of changed) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), fm.text.get(path) ?? '');
  }
  return { result, changed };
}

function listFiles(repo: string): string[] {
  return readdirSync(repo, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(repo, join(e.parentPath, e.name)).split(sep).join('/'))
    .filter((path) => !path.startsWith('.git/'));
}

function describe({ task, created, markedWorked, noteAdded }: LogWorkResult, input: LogWorkInput, outcome: string): string {
  const what = [
    created ? 'created' : 'found',
    markedWorked ? `marked worked ${input.date ?? today()}` : undefined,
    noteAdded ? 'note added' : undefined,
  ].filter(Boolean);
  return `${task.id} "${task.title}" (${task.sourceFile}): ${what.join(', ')} — ${outcome}`;
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
