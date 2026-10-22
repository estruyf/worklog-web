---
name: worklog
description: Record the work done in this session on the user's Worklog timesheet (https://github.com/estruyf/worklog-web). Finds or creates the task for the issue being worked on, marks today as worked and adds a one-line note, then pushes to their timesheet repo with the @estruyf/worklog-cli package. Use when the user runs /worklog or asks to log or record the work in their worklog or timesheet. Also use it unprompted at the end of a piece of client work, once it is committed or a PR is opened, so the work shows up in Worklog without the user retyping it. It does not log hours.
---

# Log the session's work in Worklog

Worklog keeps a timesheet as Markdown in a GitHub repo of the user's, and the app reads it from there. This skill writes to a **local clone** of that repo with the `worklog` CLI, which commits and pushes with the user's own git credentials. Nothing here talks to the Worklog site.

One run records one task: today is marked as worked and a note is added. Running the same command twice changes nothing, so a retry is always safe.

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

**No entry matches?** Ask which client the repo belongs to. Valid ids are in the timesheet's own config:

```bash
jq -r '.clients[] | select(.archived != true) | "\(.id)  \(.name)"' <repo>/.worklog/config.json
```

Offer to add the folder to `~/.config/worklog/config.json`, so the question isn't asked again. Never invent a client id: the CLI rejects an unknown one.

## 2. Find the task

Prefer a GitHub issue. It gives the title, and the link the task is found by on every later run.

1. Take the issue number from what this session worked on: the issue named in the conversation, a `(#123)` changelog entry added this session, a `#123` or `Closes #123` in the session's commits, or the number in the branch name. A branch number can belong to another tracker, so only use it when step 2 finds an issue that matches the work.
2. `gh issue view <n> --json title,url`, with `-R <issues>` when the mapping sets one.
3. Use the issue's title **exactly as it is** as `--title`, prefix and all (`Bug: …`, `#123 …`), and its url as `--link`. A task the user created by hand has no link, so an identical title is the only way the CLI finds it instead of creating a duplicate.

When the session touched several issues, log each one separately.

With no issue, look at the client's open tasks and reuse one when it is clearly the same work. The CLI matches an open task by its exact title (case-insensitive):

```bash
grep '^## ' <repo>/clients/<client>.md
```

Otherwise use a short title for the work: under 60 characters, the way a task is named, not a sentence. Leave out `--link`.

## 3. Write the note

One line, at most about 120 characters, saying what this session got done, in terms the client would recognise. Lead with the outcome, not the files. Plain language, no trailing period, no emoji.

- Good: `HTML pages are now translated as documents and saved through the HTML pages API`
- Too vague: `Worked on the issue`
- Too technical: `Added resolveHtmlPageContext.ts and changed isHtmlPage.ts`

## 4. Run it

```bash
npx --yes @estruyf/worklog-cli log --repo <repo> --client <client> \
  --title "<title>" --link <url> --note "<note>"
```

- Add `--date YYYY-MM-DD` only when the work was on a day other than today.
- `--dry-run` prints the diff and commits nothing. Use it when the user wants to see the change first.
- If a package-age guard such as Safe-chain blocks a freshly published version, follow the flag it suggests (for Safe-chain: `--safe-chain-skip-minimum-package-age` right after `npx`).

The CLI prints one line:

```
t_zkmzac "Fix the mobile picker" (clients/acme.md): created, marked worked 2026-10-22, note added — pushed 3a2a9e3
```

Pass it on to the user as is: whether the task was created or found, and the note. "nothing new to log" means today was already recorded with that note. That's fine, not an error.

## When it refuses

- **Uncommitted changes or unpushed commits in the clone.** Those are the user's own edits. Tell them and stop. Don't commit, stash, push or discard anything in the timesheet repo.
- **Unknown client.** Go back to step 1 and ask. Don't guess.
- **Push failed.** Usually there's no network or no git access. The clone was left clean, so the same command can simply be run again later.
