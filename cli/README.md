# @estruyf/worklog-cli

Log work on a task in your [Worklog](https://github.com/estruyf/worklog-web) timesheet repo with one
command — made for AI agents that finish a piece of work and should leave a trace of it on your
timesheet. The next time you open Worklog, the task is there, marked as worked.

```bash
npx @estruyf/worklog-cli log --client acme --title "Fix the mobile picker" \
  --link https://github.com/acme/app/issues/12 --note "Widened the tap targets"
```

It edits a **local clone of your timesheet repo** and pushes with your own git credentials. It never
talks to the Worklog site, so there is no token to set up.

## Options

| Option | Meaning |
| --- | --- |
| `--client` | Client id from `.worklog/config.json`. Required. |
| `--title` | Title for a new task, or of an open task to log on. Required. |
| `--link` | Issue or ticket url. The task is found again by it on later runs, archived tasks included. |
| `--id` | Log on this exact task id instead. |
| `--note` | Progress note added under the task's `### Notes`. |
| `--date` | The day worked, `YYYY-MM-DD`. Defaults to today. |
| `--repo` | Path to the clone. Defaults to `$WORKLOG_REPO`. |
| `--dry-run` | Print the diff, commit nothing. |

The task is matched by `--id`, then `--link`, then an **open task of the same title** for that
client — so a task you typed into the app yourself is picked up rather than duplicated. With no match
it is created. Running the same command twice changes nothing.

## Requirements

- Node 20 or newer, and git.
- A clone of your timesheet repo with no uncommitted changes and no unpushed commits — when its push
  loses a race with the app, the CLI resets the clone to the remote and replays its edit on top.
- Hours are not logged: it records *that* you worked on a task, not for how long.
