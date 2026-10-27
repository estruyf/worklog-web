---
name: worklog
description: Read and write the user's Worklog timesheet (https://github.com/estruyf/worklog-web) with the @estruyf/worklog-cli package, which pushes to their timesheet repo. Logs work done (marks the day worked on the issue's task and adds a one-line note), adds to-dos with a due date, priority and description (for a client, or on the general to-do list that belongs to no client), changes or closes existing tasks, lists what's open, and sets the hours worked for a client on a day when the user gives them. Use when the user runs /worklog; asks to log or record work in their worklog or timesheet; asks to create, add, plan, change, move, reprioritise or close a task or to-do there ("create a task for Friday to …", "remind me on the 13th to …", "make it high priority", "I sent it, close it"); asks what's open or due ("what's on my list this week?"); or says how long they worked or that they're off ("log 4 hours on Acme today", "I'm on vacation Friday"). Also use it unprompted at the end of a piece of client work, once it is committed or a PR is opened, so the work shows up in Worklog without the user retyping it; that unprompted use never logs hours.
---

# Work with the user's Worklog

Worklog keeps a timesheet as Markdown in a GitHub repo of the user's, and the app reads it from there. This skill works on a **local clone** of that repo with the `worklog` CLI, which commits and pushes with the user's own git credentials. Nothing here talks to the Worklog site.

Every command goes through the app's own code, so never edit the timesheet's Markdown by hand. Running the same command twice changes nothing, so a retry is always safe.

```bash
npx --yes @estruyf/worklog-cli <command> --repo <repo> [options]
```

If a package-age guard such as Safe-chain blocks a freshly published version, follow the flag it suggests (for Safe-chain: `--safe-chain-skip-minimum-package-age` right after `npx`). `--dry-run` on any command that writes prints the diff and commits nothing; use it when the user wants to see the change first.

## 0. Pick the command

Decide this first. Getting it wrong puts work on the timesheet that never happened.

| The user… | Command | A date means |
| --- | --- | --- |
| finished something, or you did the work in this session | [`log`](#log-work-done) | the day it was worked (`--date`) |
| asks to create, add, plan or be reminded of something for later | [`add`](#add-a-to-do) | the day it is due (`--due`) |
| wants an existing task moved, reprioritised, renamed, retagged… | [`update`](#change-a-task) | the new due date (`--due`) |
| says a task is finished ("I sent it", "close it", "that's done") | [`done`](#close-a-task) | — |
| asks what's open, due or on their list | [`list`](#see-whats-open) | the cutoff (`--due-by`) |
| says how long they worked, or that they're off | [`hours`](#log-hours) | the day the time is for (`--date`) |

"Create a task for the 13th of November to email Sam" is a **to-do due on the 13th** (`add`), not work done on the 13th. When a request names a date in the future, it is almost always a to-do: nobody logs work they haven't done yet. When it is genuinely unclear, ask.

A follow-up about a task you just wrote ("make it high priority", "move it to Friday") is an `update` on that task: pass the `t_…` id the CLI printed.

## 1. Read the config

```bash
cat ~/.config/worklog/config.json
```

```json
{
  "repo": "~/timesheet",
  "clients": [
    { "path": "~/code/acme/", "client": "acme" },
    { "path": "~/code/globex/portal", "client": "globex", "issues": "globex/tracker" }
  ]
}
```

- `repo` is the timesheet clone. Expand a leading `~`.
- In `clients`, take the entry whose `path` (with `~` expanded) is the **longest prefix** of the current repo's top-level folder (`git rev-parse --show-toplevel`). Its `client` is the client id.
- `issues`, when set, is the GitHub repo that holds that folder's issues. Pass it to `gh` as `-R`.

**No config file yet?** Ask where the timesheet clone is. If there isn't one, offer to clone it (`gh repo clone <owner>/<repo> <path>`), then write the file with the first mapping.

**Need a client and no entry matches, or not in a git repo?** Ask which client. Valid ids are in the timesheet's own config:

```bash
jq -r '.clients[] | select(.archived != true) | "\(.id)  \(.name)"' <repo>/.worklog/config.json
```

Offer to add the folder to `~/.config/worklog/config.json`, so the question isn't asked again (not when the folder has nothing to do with the client, like a to-do asked for from anywhere). Never invent a client id: the CLI rejects an unknown one. `todos` is the general to-do list, which belongs to no client.

## Log work done

### Find the task

Prefer a GitHub issue. It gives the title, and the link the task is found by on every later run.

1. Take the issue number from what this session worked on: the issue named in the conversation, a `(#123)` changelog entry added this session, a `#123` or `Closes #123` in the session's commits, or the number in the branch name. A branch number can belong to another tracker, so only use it when the next step finds an issue that matches the work.
2. `gh issue view <n> --json title,url`, with `-R <issues>` when the mapping sets one.
3. Use the issue's title **exactly as it is** as `--title`, prefix and all (`Bug: …`, `#123 …`), and its url as `--link`. A task the user created by hand has no link, so an identical title is the only way the CLI finds it instead of creating a duplicate.

When the session touched several issues, log each one separately.

With no issue, look at the client's open tasks and reuse one when it is clearly the same work (`list --client <client>`). The CLI matches an open task by its exact title, case-insensitive. Otherwise use a short title for the work: under 60 characters, the way a task is named, not a sentence. Leave out `--link`.

### Write the note

One line, at most about 120 characters, saying what this session got done, in terms the client would recognise. Lead with the outcome, not the files. Plain language, no trailing period, no emoji.

- Good: `HTML pages are now translated as documents and saved through the HTML pages API`
- Too vague: `Worked on the issue`
- Too technical: `Added resolveHtmlPageContext.ts and changed isHtmlPage.ts`

### Run it

```bash
npx --yes @estruyf/worklog-cli log --repo <repo> --client <client> \
  --title "<title>" --link <url> --note "<note>"
```

Add `--date YYYY-MM-DD` only when the work was on a day other than today. It prints one line:

```
t_zkmzac "Fix the mobile picker" (clients/acme.md): created, marked worked 2026-10-22, note added — pushed 3a2a9e3
```

Pass it on to the user as is: whether the task was created or found, and the note. "nothing new to write" means the day was already recorded with that note. That's fine, not an error.

If the work finished the task (the PR is merged, the issue closed), also [close it](#close-a-task).

## Add a to-do

The task is open and nothing is marked worked: no `worked:` day, no note. Its date is when it is due, and what it is about goes in its description.

**Client or general to-do list?** A to-do goes to a client only when it is that client's work: the user names the client, or it is part of the client work in this session. Everything else (personal errands, admin, follow-ups that belong to no one client) goes on the **general to-do list**: leave out `--client`. The folder you are in is a hint, not the rule: "renew my passport" asked in a client's repo is still a general to-do. When it could be either, ask, and offer the general to-do list as one of the answers.

Check that list's open tasks first (`list --client <client>`, or `list --client todos`), so you don't add one that's already there.

- **Title**: what has to be done, as a task is named: imperative, under 60 characters. `Email Sam and Priya`, not `Task to send an email`.
- **Description**: one or two sentences with the context the title leaves out. Keep the user's conditions and wording: `Ask Sam and Priya whether the workshop becomes a roundtable or a session`.
- **Due date**: resolve relative dates ("the 13th of November", "next Friday") against today and pass `YYYY-MM-DD`.
- **Priority**: `urgent`, `high` or `low`, only when the user said so. No flag means normal.
- **Tags**: `--tag`, once per tag, only when the user gave them.
- **Subtask**: `--parent <t_…>` when it belongs under an existing task.
- **Link**: the issue url, when the to-do comes from one.

```bash
npx --yes @estruyf/worklog-cli add --repo <repo> --client <client> \
  --title "<title>" --due <YYYY-MM-DD> --priority <level> --description "<description>"
```

Leave out `--client` for the general to-do list, and leave out any flag the user gave nothing for. It prints:

```
t_469p6i "Email Sam and Priya" (clients/acme.md): created, due 2026-11-13, priority high — pushed 3a2a9e3
```

"already exists, left as is" means an open task with that title (or link) is already there, and it was not touched. Tell the user. If they wanted it changed, that's an [`update`](#change-a-task); don't add it again under another title to force a new one.

## Change a task

Name the task, then pass only what changes:

```bash
npx --yes @estruyf/worklog-cli update --repo <repo> --id <t_…> --due 2026-11-20 --priority high
```

- **Naming it**: `--id` when you have it (the CLI printed it, or `list` shows it). Otherwise `--link`, or `--title` with the exact title. A title shared by open tasks of several clients is refused with their ids: add `--client`, or ask the user which one.
- **Changes**: `--rename "<title>"`, `--due <date>` (`none` clears it), `--priority <level>` (`normal` clears it), `--description "<text>"` (`""` clears it), `--tag` / `--untag` (repeatable), `--parent <t_…>` (`none` makes it top-level), `--status <id>` (one of the statuses in `<repo>/.worklog/config.json`).

It prints the fields that changed, or "already up to date".

## Close a task

```bash
npx --yes @estruyf/worklog-cli done --repo <repo> --id <t_…>
```

Named like `update`. Its subtasks close with it. A recurring task isn't closed: it rolls on to its next occurrence, and the CLI says when that is due. "already closed" means there was nothing to do.

## See what's open

```bash
npx --yes @estruyf/worklog-cli list --repo <repo> --due-by 2026-11-30 --json
```

Read-only; it fetches the latest first. `--client <id>` narrows it to one client (`todos` for the general list), `--due-by <date>` to tasks due by then (undated ones drop out), `--tag <tag>` to one tag. Use `--json` when you read the result yourself, and answer the user in a short list, not the raw output. Without `--json` it prints one tab-separated line per task: id, due, priority, client, status, title.

## Log hours

Time is tracked **per client per day**, not per task: one line per client per day, which the app adds up against the working day. Log hours only when the user gives them. Never estimate them from how long a session took, and never log them on your own at the end of a piece of work: the timesheet is what the user bills from.

```bash
npx --yes @estruyf/worklog-cli hours --repo <repo> --client <client> --hours 4 --note "<what it went to>"
```

- **Amount**: `full`, `half` (both follow the configured working day), or a number of hours. `0` removes the line.
- **It sets, it doesn't add.** `--hours 4` makes the client's total for that day 4h, whatever was there. For "2 more hours on Acme", first run `hours` without `--hours` to see the day (`--date` for another day), add it up, and set the sum.
- **Day off**: `--event` instead of `--client`: `vacation`, `public-holiday`, `out-of-office`, `conference`, `sick` or `other`. A range ("vacation next week") is one command per working day.
- **Note**: optional, one short line. Left out, the note already on that line stays.
- **Client**: as in step 1. The general to-do list has no hours, and an archived client is refused.

It prints the new value, what it was, and the day's total against the working day:

```
Acme Corp on 2026-10-27: 4h (was 8h); day total 12h of 8h — pushed 3a2a9e3
```

Pass it on. A day total over the working day isn't an error, but do mention it: it often means another client's line for that day needs to come down too.

## When it refuses

- **Uncommitted changes or unpushed commits in the clone.** Those are the user's own edits. Tell them and stop. Don't commit, stash, push or discard anything in the timesheet repo.
- **Unknown client.** Go back to step 1 and ask. Don't guess.
- **Several open tasks match, or none does.** Show the user what the CLI said and ask which task they mean. Don't pick one.
- **An option the command doesn't have.** Usually the wrong command for the job, like `--date` on `add`: go back to step 0.
- **Push failed.** Usually there's no network or no git access. The clone was left clean, so the same command can simply be run again later.
