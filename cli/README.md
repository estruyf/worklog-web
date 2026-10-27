# @estruyf/worklog-cli

Work with your [Worklog](https://github.com/estruyf/worklog-web) timesheet repo from the command line —
made for AI agents. Log the work they finished, add to-dos with a due date and priority, change or
close tasks, list what's open, and set the hours worked on a day. The next time you open Worklog, it's all there.

```bash
npx @estruyf/worklog-cli log --client acme --title "Fix the mobile picker" \
  --link https://github.com/acme/app/issues/12 --note "Widened the tap targets"

npx @estruyf/worklog-cli add --client acme --title "Email Sam about the workshop" \
  --due 2026-11-13 --priority high --description "Ask whether it becomes a roundtable or a session"

npx @estruyf/worklog-cli update --id t_469p6i --due 2026-11-20
npx @estruyf/worklog-cli done --id t_469p6i
npx @estruyf/worklog-cli list --due-by 2026-11-30
npx @estruyf/worklog-cli hours --client acme --hours 4 --note "Picker fixes"
```

It edits a **local clone of your timesheet repo** and pushes with your own git credentials. It never
talks to the Worklog site, so there is no token to set up.

Every command takes `--repo` (the clone; defaults to `$WORKLOG_REPO`), and every command that writes
takes `--dry-run` (print the diff, commit nothing). Running the same command twice changes nothing.
Each command refuses options it doesn't have, so a to-do's due date can never end up as a day worked.

## `log` — work done

| Option | Meaning |
| --- | --- |
| `--client` | Client id from `.worklog/config.json`. Required. |
| `--title` | Title for a new task, or of an open task to log on. Required. |
| `--link` | Issue or ticket url. The task is found again by it on later runs, archived tasks included. |
| `--id` | Log on this exact task id instead. |
| `--note` | Progress note added under the task's `### Notes`. |
| `--date` | The day worked, `YYYY-MM-DD`. Defaults to today. |

The task is matched by `--id`, then `--link`, then an **open task of the same title** for that
client — so a task you typed into the app yourself is picked up rather than duplicated. With no match
it is created.

## `add` — a to-do

Creates an **open task**: nothing is marked worked and no note is written.

| Option | Meaning |
| --- | --- |
| `--title` | The task's title. Required. |
| `--client` | Client id. Leave it out for the general to-do list, the one that belongs to no client. |
| `--due` | The day the task is due, `YYYY-MM-DD`. |
| `--priority` | `urgent`, `high`, `normal` or `low`. Defaults to normal. |
| `--description` | What the task is about, written under its fields. |
| `--tag` | A tag. Repeat it for several. |
| `--parent` | A task id, making the new task its subtask. |
| `--link` | Issue or ticket url. |

An open task with the same link or title is left as it is rather than duplicated.

## `update` — change a task

Name the task with `--id`, `--link` or `--title` (an open task's exact title; add `--client` when
several clients have one), then pass only what changes:

| Option | Meaning |
| --- | --- |
| `--rename` | A new title. |
| `--due` | A new due date, or `none` to clear it. |
| `--priority` | A new priority; `normal` clears it. |
| `--description` | A new description; `""` clears it. |
| `--status` | A status id from `.worklog/config.json`. A closing one closes the task. |
| `--tag` / `--untag` | Add or remove a tag. Repeatable. |
| `--parent` | Move it under this task id, or `none` to make it top-level. |

A title that matches open tasks of several clients is refused, with their ids, rather than guessed.

## `done` — close a task

Named like `update`. The task moves to the archive with its subtasks, as when you close it in the app.
A recurring task rolls on to its next occurrence instead.

## `list` — what's open

Read-only: it catches up with the remote first, and prints one tab-separated line per open task (id,
due, priority, client, status, title), soonest due first.

| Option | Meaning |
| --- | --- |
| `--client` | Only this client's tasks; `todos` for the general to-do list. |
| `--due-by` | Only tasks due on or before this day. |
| `--tag` | Only tasks with this tag. |
| `--json` | Print JSON instead, with descriptions, tags and links. |

## `hours` — time worked

Time is tracked per client per day, as in the app's day editor, with the same rules: one line per
client per day, `full` and `half` follow your working day (`hoursPerDay`), the general to-do list has
no hours and an archived client is refused.

| Option | Meaning |
| --- | --- |
| `--client` | The client the time is for. Or… |
| `--event` | …a day off: `vacation`, `public-holiday`, `out-of-office`, `conference`, `sick` or `other`. |
| `--hours` | `full`, `half` or a number of hours. **Sets** the day's total for that client; `0` removes it. |
| `--date` | The day, `YYYY-MM-DD`. Defaults to today. |
| `--note` | What the time went to. Left out, the note already there is kept. |

Without `--hours` it is read-only and prints what's logged that day, and the total against your
working day.

## Requirements

- Node 20 or newer, and git.
- A clone of your timesheet repo with no uncommitted changes and no unpushed commits — when its push
  loses a race with the app, the CLI resets the clone to the remote and replays its edit on top.
- `log` records *that* you worked on a task, not for how long; hours are `hours`, per client per day.
