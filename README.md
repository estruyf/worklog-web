# Worklog

![Visitors](https://api.visitorbadge.io/api/visitors?path=https%3A%2F%2Fworklog.struyfconsulting.be&labelColor=%23e2be2e&countColor=%23e2be2e&slug=github)

A standalone, GitHub-backed web app for managing a **Worklog** timesheet. Sign in with GitHub,
pick the repo that holds your timesheet, and manage tasks, time entries, clients, archiving and
insights. Every edit is committed straight back to your repo.
**Markdown is the source of truth.**

**Try it: <https://worklog.struyfconsulting.be>**

- **Stack:** Astro (SSR) + React islands + Tailwind, deployed on Cloudflare.
- **Auth:** GitHub OAuth App; the token stays in an httpOnly cookie and never reaches the browser.
- **Writes:** direct commits to a branch via the GitHub Git Data API (no PRs).

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Quick start](#quick-start)
3. [Step 1 — Create a GitHub OAuth App](#step-1--create-a-github-oauth-app)
4. [Step 2 — Configure local environment](#step-2--configure-local-environment)
5. [Step 3 — Install and run](#step-3--install-and-run)
6. [Step 4 — Sign in and pick a repo](#step-4--sign-in-and-pick-a-repo)
7. [Using the app](#using-the-app)
8. [Offline](#offline)
9. [Quick capture — task deeplinks](#quick-capture--task-deeplinks)
10. [Hand a task to an AI agent](#hand-a-task-to-an-ai-agent)
11. [Testing](#testing)
12. [Deploying to Cloudflare](#deploying-to-cloudflare)
13. [Environment variables](#environment-variables)
14. [Expected repository layout](#expected-repository-layout)
15. [How it works](#how-it-works)
16. [Project structure](#project-structure)
17. [Troubleshooting](#troubleshooting)
18. [Known limitations](#known-limitations)

---

## Prerequisites

- **Node.js 22.12+** and npm (required by Astro 7).
- A **GitHub account** with a repository that holds (or will hold) your Worklog files
  (see [Expected repository layout](#expected-repository-layout)).
- For deployment only: a **Cloudflare account** and the `wrangler` CLI (bundled as a dev dependency).

## Quick start

```bash
git clone <this-repo> worklog-web && cd worklog-web
npm install
cp .dev.vars.example .dev.vars      # then fill in your GitHub OAuth credentials
npm run dev                         # http://localhost:4321
```

The two steps that need real values are the **GitHub OAuth App** and the **`.dev.vars`** file —
both are covered in detail below.

---

## Step 1 — Create a GitHub OAuth App

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
   (Or directly: <https://github.com/settings/applications/new>.)
2. Fill in:
   | Field | Value |
   | --- | --- |
   | **Application name** | `Worklog` (anything you like) |
   | **Homepage URL** | `http://localhost:4321` |
   | **Authorization callback URL** | `http://localhost:4321/api/auth/callback` |
3. Click **Register application**.
4. On the app page, copy the **Client ID**, then click **Generate a new client secret** and copy
   the **Client secret** (you only see it once).

> **Scopes:** the app requests `repo` (so it can read and commit to private timesheet repos) and
> `read:user` (to show who is signed in). GitHub asks the user to approve these on first sign-in.

> When you deploy, add a **second** callback URL for production
> (`https://<your-domain>/api/auth/callback`) to the same OAuth App, or create a separate app for
> production.

## Step 2 — Configure local environment

Copy the example file and paste in the credentials from Step 1:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` (read automatically by `astro dev` via the Cloudflare platform proxy):

```ini
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
# Optional — force the OAuth redirect/base URL (defaults to the request origin):
# APP_BASE_URL=http://localhost:4321
```

`.dev.vars` is git-ignored — never commit your client secret.

## Step 3 — Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:4321>. Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on `http://localhost:4321`. |
| `npm run build` | Production build (Cloudflare worker + client assets in `dist/`). |
| `npm run preview` | Preview the production build locally with Wrangler. |
| `npm test` | Run the golden round-trip tests (see [Testing](#testing)). |
| `npm run check` | Astro/TypeScript diagnostics. |

## Step 4 — Sign in and pick a repo

1. Click **Sign in with GitHub** and approve the requested scopes.
2. You are returned to the app and shown a **repository picker**. Either:
   - search your repositories and click one, or
   - type `owner/repo` (optionally `owner/repo@branch`) and press **Open**.
3. The app loads that repo's Worklog files and renders the dashboard. The chosen repo is
   remembered and encoded in the URL (`/app?owner=…&repo=…&branch=…`), so it reopens on refresh.

Use the **repo pill** in the top-right to switch repositories, open the repo on GitHub, or sign out.

---

## Using the app

The dashboard has these views:

- **Day** — the default view. Your day is one proportional bar: every entry is drawn at the size of
  its own hours against your working day, and whatever is left over is an **Unlogged** slot you
  click to fill — which opens the log form on exactly those hours. Click a segment to edit that
  entry (full day, half day, or custom hours, plus an optional note), or log a non-client **event**
  (vacation, out-of-office, …). Logging past your working day is allowed: the bar grows past the
  target and the day reads as over. On a day with nothing logged yet, **Same as yesterday** copies
  the last day you logged. See overdue, due, open, worked, and done tasks for that day; mark a task
  worked, change its status, or close it. Anything past its due date sits in an **Overdue** block at
  the very top. Alongside the to-do list, a **Links** panel gathers the reference links of the
  clients the day is about — whoever you logged time to, plus whoever owns a task the day shows —
  so their board or repo is one click away. It follows the day, and stays hidden when those
  clients have no links.
- **Overdue** — everything that has slipped, across every client and the to-do list, grouped by
  client with the longest-overdue client first, plus what is due today. The nav badge counts it.
- **To-dos** — the general to-do list: tasks that belong to no client.
- **Calendar** — a month grid of logged time; click a day to jump to it, or plan a task with a
  due date.
- **Clients** — every client and its open tasks. Create/edit clients (name, accent colour, a
  Markdown description and reference links — the repo, the shared drive, the ticket board — shown
  above the client's tasks), add
  tasks with links, tags, due dates, descriptions and subtasks. Retire a client you no longer work
  with by **archiving** it: it drops out of the pickers, the Day view and the log form, while every
  task and logged hour stays put and keeps reporting. Archived clients are listed (and restored)
  under the client list. **Delete** is offered only for a client with no tasks and no logged time —
  anything else would orphan billing history, so archive that instead.
- **Archive** — closed tasks by client/month; reopen one to move it back to its client file.
- **Insights** — per-client hours and derived days for a month, an events breakdown, and a monthly
  trend chart.

**Statuses:** a task's status is the coloured word at the start of its row. Click it — on a task
row, in the detail panel, or on a subtask — and pick where the task has got to. The list is yours:
**Settings → Task statuses** adds, renames, recolours, reorders and removes them, so "Waiting for"
or "In review" sits alongside the shipped Open / In progress / Closed. Each one is stored under its
own id (`Waiting for` → `- status: waiting-for`), which is what your Markdown carries, so renaming a
status re-labels every task in it at once without touching a file.

The last status is the **closing** one. Picking it completes the task, stamps `- completed:` and
moves the block to `archive/`, cascading to any still-open subtasks — so it can be renamed and
recoloured but never removed or reordered. Picking a working status on a closed task pulls it back
out of the archive. Removing a status only takes it out of the pickers: tasks still sitting in it
keep the status they have and go on showing it, because the id is in your Markdown and reassigning
them would be a bulk edit you didn't ask for. Those tasks stay listed under **Still in use** in
Settings, where the status can be put back or the remaining tasks moved on.

**Markdown, and checkboxes that stick:** descriptions, task notes and day notes all take Markdown —
headings, emphasis, code, quotes, links, pasted images and `- [ ]` task lists. In **Preview**, a
description's or a day note's checkbox can be ticked and unticked: the tick rewrites that one line
in your Markdown (`- [ ]` ⇄ `- [x]`) and saves, leaving everything else on the line untouched. A
task's own notes and a client's description render their boxes read-only — there is nothing to
write back through.

**Saving:** edits are written to an in-memory copy of your Markdown immediately, then committed to
GitHub automatically about a minute after your last change. Click the **sync** button in the top
bar to commit right away. Commit messages use the format `chore: worklog sync <date>`.

Settings has a second lever for this: **Sync right away after** — tick the kinds of change worth
pushing without delay (a task or to-do created, a task changing state, a task edited, time logged,
clients, statuses or settings changed) and those are committed within seconds rather than waiting out the sync
delay. It stands on its own, so you can leave the background timer off entirely and still have the
changes you care about land on the branch as you make them. Everything else then waits for the sync
button — except a failed automatic sync, which is retried on the delay either way rather than left
sitting.

A sync goes both ways: it first checks where the branch head is on GitHub and pulls in anything
committed elsewhere — another device, an edit made on github.com — before (and, when the branch had
moved, again after) pushing your own changes. With nothing of your own to push, sync is a plain pull.

A commit writes whole files, so a file that changed on both sides is merged before it's pushed —
record by record, not line by line. Task blocks are matched by their `id`, ledger lines by date +
client, config entries by their id, and the standard three-way rule applies to each: a record only
one side touched takes that side's version (including deletions), and one both sides touched keeps
yours and says so. So a task added in one browser tab and an edit made in another both survive,
whichever tab syncs first. The same merge runs when unsynced changes are recovered on open, so
restoring never rolls the branch back.

An open tab doesn't wait for a sync to notice a push from somewhere else. It checks the branch head
once a minute, and again the moment you switch back to the tab, so coming back after committing from
another device pulls the changes in on its own. The check is skipped while the tab is in the
background and whenever you have unsynced edits — those are the sync button's business, since only a
sync knows how to commit on top of a branch that moved. There's no GitHub notification behind this:
nothing tells the app a push happened, so it asks (one cheap ref lookup per check).

**Priority:** four levels — Urgent, High, Normal, Low — set on the task form or in the detail
panel's rail, next to the status. Normal is the default and the quiet one: it puts no marker on the
row and writes nothing into your Markdown, so the chip on a task means someone decided something.
Every open list can sort by priority and filter to one level, and the filter only appears once
something in that list has a priority — a picker whose one option is "Normal" would say nothing.
See [Priority](#priority) for what it looks like in the files.

**Tags:** the task form picks from the tags already in use — type to filter them, `↑/↓` and `↵` to
choose, and **Create "…"** appears only when nothing existing matches, so the vocabulary doesn't
drift into typos. A re-spelling folds onto the tag that exists (typing `Mobile` reuses `mobile`).

A tag chip is also a filter wherever it appears — click one on a task, in the detail panel or in a
search hit to see every task carrying it, open and archived. Search (`⌘/Ctrl+F`) has a tag row of
its own: pick one or more tags (a task must carry all of them) with or without a query.

**The sidebar:** the view tabs sit above the things you reach for from anywhere — Search, Git sync,
Shortcuts, Settings, the browser extension, What's new, and **Report an issue**, which opens a new
issue on Worklog's own repo in a new tab. The button beside the wordmark collapses the rail to its
icons and expands it again; collapsed, every row keeps its name as a tooltip and the To-dos and
Overdue counts move to the corner of their icon. The choice is remembered per device. On a phone the
rail is a drawer behind the hamburger instead, so there is nothing to collapse.

**Keyboard shortcuts:** `⌘/Ctrl+N` new task · `⌘/Ctrl+F` or `⌘/Ctrl+S` search · `⌘/Ctrl+L` log time
(Day view) · `⌘/Ctrl+R` reload from GitHub · `Esc` close the top dialog.

**App shortcuts:** with Worklog installed, long-pressing its icon on a phone — or right-clicking it
in the dock, taskbar or launcher — jumps straight to **New task**, **Day**, **Calendar** or
**To-dos**, in the app window rather than a browser tab. The repo that opens is the last one you
had open on that device, so a shortcut is one press from a standing start.

**App badge:** the installed icon carries a count — everything overdue plus what's due today, the
same number the **Overdue** view opens onto. It's set while the app is open and cleared when there's
nothing left; nothing recounts in the background, so the badge reads as of the last time you had
Worklog open. Switching repo or signing out takes it down. Chromium and Safari show it on an
installed app; a browser tab and Firefox simply don't, and nothing else changes.

---

## Offline

Worklog installs as a PWA, and once a repo has been opened on a device it keeps working without a
connection — including a cold start, with the tab closed and the app relaunched.

- **Opening offline** shows the branch as this device last saw it, plus any edits that never made
  it to GitHub.
- **Editing offline** works normally. Changes are written to the device as you go, so closing the
  tab — or the browser crashing — doesn't lose them.
- **You're told, and kept told.** A bar across the top of the view says you're offline and how many
  files are waiting; Git sync in the sidebar becomes an **Offline** indicator, with a chip in the
  top bar on a phone. The bar stays after you reconnect if changes still haven't been sent, with a
  **Sync now** button — it only goes away when there's genuinely nothing left to send. (It stays
  quiet when automatic sync is on and about to handle it for you.)
- **Reconnecting** pushes what was waiting, if automatic sync or a sync-on-change event is enabled
  (Settings → Sync). With both off nothing leaves unprompted, exactly as when you're online: press
  **Git sync**. What lands is merged record by record against whatever the branch holds by then, so
  a day spent offline reconciles the same way a minute does.

Two things need the network: **signing in**, and **opening a repo this device has never opened** —
there is nothing cached to show, so you get the error screen rather than an empty timesheet.

Inline images are the one thing that degrades. The cached copy holds your Markdown, not the bytes
under `assets/`, so an image renders as its alt text until you're back online. That is a deliberate
trade — the images are most of a repo's size and none of its meaning, and storage quota is what
decides whether opening offline works at all.

Signing out clears the cached repo contents from the device. Unsynced edits are kept: they are the
only copy of work GitHub has never seen.

---

## Quick capture — task deeplinks

`/app/new` accepts the task in its query string, so anything that can open a URL — a browser
extension, a bookmarklet, a shortcut — can hand Worklog a task instead of you retyping it. The link
**opens the new-task form pre-filled**; it does not save anything. You review it and press Save, and
the task goes through the normal write path from there.

```
https://<your-worklog>/app/new?title=Fix%20the%20login%20redirect
  &url=https://github.com/acme/web/issues/12
  &label=Issue%2012
  &client=acme
```

| Param | Fills | Notes |
| --- | --- | --- |
| `title` | Title | Flattened to one line. |
| `url` | A link's URL | Repeat it for several links. Only `http`, `https` and `mailto` are accepted. |
| `label` | That link's label | Optional. Pairs with `url` by position: first `label` goes with first `url`. |
| `client` | Client | The client's **id or name**, case-insensitive (`acme` and `Acme Corp` both work). `todos` is the general to-do list. Unknown values fall back to the usual default client. |
| `parent` | Parent task | The parent task's `id`, making the new task a subtask. |
| `priority` | Priority | `urgent`, `high` or `low`, case-insensitive. Anything else is ignored. |
| `due` | Due date | `YYYY-MM-DD`. Anything else is ignored. |
| `tags` | Tags | Comma-separated (`?tags=api,billing`) or repeated (`?tags=api&tags=billing`). |
| `description` | Description | Markdown. Line breaks survive. |

Everything is editable before you save, and every param is optional — `/app/new?title=Call%20Bob`
is a valid deeplink. Unrecognized params are left alone, so the `owner`/`repo`/`branch` query that
selects the mounted repository can ride along.

**A bookmarklet** — the fastest way to try it. Save this as a bookmark and click it on any page:

```js
javascript:(()=>{const q=new URLSearchParams({title:document.title,url:location.href});
open('https://<your-worklog>/app/new?'+q)})()
```

**A browser extension** does the same thing with per-site rules, which is what makes one extension
cover several clients — map the host to the client id and let the tab supply the rest:

```js
// background.js — one context-menu click sends the current tab to Worklog
const RULES = [
  { match: 'https://app.productive.io/', client: 'client-a', label: 'Productive' },
  { match: 'https://github.com/acme/',   client: 'client-b', label: 'GitHub' },
];

chrome.contextMenus.onClicked.addListener((_info, tab) => {
  const rule = RULES.find((r) => tab.url.startsWith(r.match));
  if (!rule) return;
  const q = new URLSearchParams({ title: tab.title, url: tab.url, label: rule.label, client: rule.client });
  chrome.tabs.create({ url: `https://<your-worklog>/app/new?${q}` });
});
```

**A `web+worklog:` link** covers the callers that can't open an https URL into the right place — a
native app, a shell script, a note in a mail client. **Install Worklog as an app** (Chrome or Edge,
desktop or Android) and the install claims the scheme; from then on this is a task:

```
web+worklog://new?title=Call%20Bob&client=acme
```

It takes exactly the params in the table above and goes through the same sanitizing — the whole
link is handed to `/app/new`, which unpacks its query. The link opens the app window, not a tab.

There is no in-app button for this, on purpose. A site can also ask to handle a scheme with
`registerProtocolHandler`, but that claims it for the *browser*, and on macOS the browser's claim
outranks the installed app's — so asking for it is what stops the link opening the app, and
Chrome and Edge have no matching call to take it back. In a browser tab you don't need the scheme
anyway: `/app/new?title=…` is the same feature with nothing to register.

If a `web+worklog:` link opens a browser window that then does nothing, a stale claim of that kind
is the usual cause. Clear it under *Settings → Privacy and security → Site settings → Protocol
handlers*, in the profile you pressed it in, and reinstall the app.

Only `web+worklog` is claimed — a site can't register a bare scheme like `worklog:`.

**The share sheet** is the same thing without a link to write. Install Worklog as an app (Chrome or
Edge, desktop or Android) and it shows up wherever the OS offers *Share* — a browser tab, a mail
message, a selection on a phone. Sharing to it opens the new-task form pre-filled, exactly as a
deeplink does; the shared page title becomes the title, its URL becomes a link, and any shared text
becomes the description.

Apps decide for themselves what they put in each field, and a fair number send the URL as text
rather than as a URL. When that happens it lands in the description instead of as a link — still
there, just in the body. Move it, or don't; the form is editable either way.

Notes worth knowing:

- **The params disappear from the URL** as soon as the form opens. They are read once and moved into
  the form's starting values, so they don't trail behind you as you navigate the rest of the app.
  (Reloading the form does restore what the link sent — that's the same as any other new-task form.)
- **A deeplink closes to the dashboard.** Because the link arrived from outside, there's no previous
  page in the app to go back to.
- **Values are treated as untrusted.** They end up in Markdown that has to keep round-tripping, so
  titles and labels are flattened to a single line, unsafe URL schemes are dropped, and each field
  is length-capped. If a field arrives mangled, that's why — edit it in the form.
- **Sign in first.** A deeplink opened while signed out lands on the sign-in page and the task is
  lost; open the app once, then use the link.

---

## Hand a task to an AI agent

The other direction: a task can open as a prompt in **GitHub Copilot** or **Claude Code** in VS Code,
so you don't retype what you already wrote down. Both are **off until you turn them on** in
**Settings → AI agents**; once on, they appear in a task's **Actions** list.

This needs the [Command Executor](https://marketplace.visualstudio.com/items?itemName=eliostruyf.execcommand)
extension installed in VS Code, **version 0.0.2 or newer**. A `vscode://` link can open a file on its
own, but nothing built in runs a command — that extension is the bridge, and without it the link
resolves to nothing. (0.0.2 is what added multi-argument commands; on an older one the agent opens
with no prompt.)

| Agent | Opens |
| --- | --- |
| GitHub Copilot | Copilot Chat, with the prompt in the input box, unsent. |
| Claude Code | A Claude Code tab, with the prompt in its input box, unsent. |

The prompt is the task's **title and description**, nothing else. Like a deeplink in the other
direction, the link fills something in and never submits it: you read it, change it and send it
yourself.

Worth knowing:

- **It lands in the focused VS Code window.** The link carries no repo, so open the project first —
  otherwise the prompt arrives wherever you last were.
- **Nothing is stored on the task.** No issue is created, no branch, no link written back. This is a
  handoff, not an integration.
- **Desktop only.** On a phone there is no VS Code to open, so the rows do nothing there.

---

## Testing

The test suite parses and re-serializes a timesheet repo and asserts the round-trip is faithful —
this is what guarantees commits stay diff-clean and the Markdown stays portable. By default it
runs against the fixture repo in `test/fixtures/timesheet`, so `npm test` works on a clean checkout;
point `WORKLOG_DATA_DIR` at a real repo to run the same assertions over live data.

```bash
npm test                                            # fixture repo in test/fixtures/timesheet
WORKLOG_DATA_DIR=/path/to/your/timesheet npm test   # point at any timesheet repo
```

---

## Deploying to Cloudflare

```bash
npm run build
npx wrangler deploy
```

Set the production secrets (they are not read from `.dev.vars` in production):

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put APP_BASE_URL        # e.g. https://worklog.example.com
```

Finally, add the production callback URL to your GitHub OAuth App:

```
https://<your-domain>/api/auth/callback
```

> `APP_BASE_URL` makes the OAuth redirect deterministic behind proxies/custom domains. If unset,
> the app uses the incoming request's origin.

## Environment variables

| Variable | Required | Where | Purpose |
| --- | --- | --- | --- |
| `GITHUB_CLIENT_ID` | Yes | `.dev.vars` (local), Wrangler secret (prod) | OAuth App client id. |
| `GITHUB_CLIENT_SECRET` | Yes | `.dev.vars` (local), Wrangler secret (prod) | OAuth App client secret — server-side only. |
| `APP_BASE_URL` | No | `.dev.vars` / Wrangler secret | Absolute base URL used for the OAuth callback; defaults to the request origin. |

---

## Expected repository layout

Point the app at a repo that already uses the Worklog layout:

```
.worklog/config.json           # clients, statuses, hoursPerDay, weekStart, defaultTaskSort
clients/<id>.md                # open tasks
archive/<client>/<YYYY-MM>.md  # closed tasks
worklog/<YYYY-MM>.md           # time entries: - <YYYY-MM-DD> <clientId|event:type> <hours>
notes/<YYYY-MM>.md             # freeform notes per day (optional)
assets/                        # images pasted into notes + files attached to tasks (optional)
```

`.worklog/config.json` holds the app's own settings. `statuses` is the list a task moves through,
in the order the picker offers them — the app writes it, and it is safe to hand-edit:

```json
{
  "hoursPerDay": 8,
  "weekStart": "monday",
  "defaultTaskSort": { "key": "created", "dir": "desc" },
  "clients": [{ "id": "acme", "name": "Acme Corp", "color": "#2D6CDF" }],
  "statuses": [
    { "id": "open", "label": "Open" },
    { "id": "waiting-for", "label": "Waiting for", "color": "#C8860D" },
    { "id": "in-progress", "label": "In progress" },
    { "id": "done", "label": "Closed", "terminal": true }
  ]
}
```

`defaultTaskSort` is the order task lists open in, and what their **Reset** returns to. `key` is one
of `created`, `due`, `priority`, `title` or `status`; `dir` is `asc` or `desc` — so newest-first is
`{ "key": "created", "dir": "desc" }`. Set it in Settings, or from **Save as default** in any list's
filter bar. A list's own sort picker overrides it for that session without changing the setting.
Leaving the key out reads as created / ascending, which is how lists have always been ordered.

`id` is what a task's `- status:` line carries; `label` is what you see; `color` is an optional
`#rrggbb` accent. Exactly one status is `terminal` — the closing one, which archives a task — and
it always sits last. A list that flags none is read with its last entry as the closing one, a list
that flags several keeps the first, and duplicate or nameless entries are dropped; the file is
rewritten in that normalized form the next time the app saves it.

A task block looks like:

```markdown
## Fix the mobile picker
- id: t_awxnyh
- status: in-progress
- priority: high
- link: https://example.com/task/123
- attachment: assets/picker-crash.log
- created: 2026-06-30
- due: 2026-07-05
- worked: 2026-06-30
- tags: mobile, bug

Free-form description in Markdown.

### Notes
- 2026-06-30 14:12 — Reproduced on iOS Safari.
```

`- attachment:` names a file stored beside the Markdown under `assets/` — any file type, up to
10 MB, added from the task's Actions rail (or dropped onto its Attachments list) and downloaded by
clicking its name. The line is the record: deleting an attachment in the app removes the line and
the file together, and a hand-written line pointing at a file the repo doesn't hold simply won't
download.

A new task starts at a `## ` heading that has an `- id:` line directly under it.
That means a description can use `## ` headings of its own — they stay part of the
description. A hand-written `## ` heading with no `- id:` under it is read as prose,
not as a task, so give new blocks an id (or create them in the app, which does).

### Priority

`- priority:` is one of `urgent`, `high` or `low`. There is no fourth value to write: a task with
no priority line is **normal**, which is the middle of the scale, and choosing Normal in the app
removes the line rather than writing `- priority: normal`. That is deliberate — it keeps the field
out of every task you never prioritized, and out of the diffs.

Unlike statuses, the scale is fixed and not configurable. A status list is a workflow, which is
yours to design; a priority is an ordering, and orderings are the same everywhere.

The value is read case-insensitively (`High` works). A value the scale doesn't name — say
`- priority: critical` — is **left in the file** and sorts as normal, so nothing you hand-type is
silently deleted. The app only ever writes the three ids above, so editing that task in the app and
saving it will normalize it away.

Sorting by priority puts the most important first, with unprioritized tasks in the middle where
they belong — not shunted to the end the way a task with no due date is. Priority is not folded
into the other sorts as a tiebreak, so turning it on doesn't quietly re-order lists.

### Subtasks

A task becomes a subtask of another by naming its parent's `id`. The line goes
in the block's metadata, which is where the app writes it:

```markdown
## Ship the mobile release
- id: t_9kf2ap
- status: in-progress

## Fix the mobile picker
- id: t_awxnyh
- status: open
- parent: t_9kf2ap
```

Parent and child are two ordinary task blocks — nothing nests in the Markdown, so
both stay editable on their own and a subtask keeps its own due date, tags, notes
and description. They don't have to sit in the same file, though the app only ever
offers parents from the client you're already on.

| Behaviour | What happens |
| --- | --- |
| Completing a parent | Closes every open descendant with it, all the way down. |
| Deleting a parent | Deletes its descendants too — git is the trace. |
| A `parent:` pointing at a missing id | The task reads as top-level; nothing is dropped. |
| A `parent:` that would form a cycle | Refused when set in the app. Hand-written cycles aren't validated — don't write one. |

Nesting is recursive in the format, but the app's parent picker only lists open
top-level tasks, so what it creates is one level deep. In the app, open a task and
use **Add subtask** in the header or at the bottom of its subtask list.

### Day notes

The day view has a freeform Markdown field for the half of a day that isn't billed
and isn't a task — what was said, what was decided, what you want to remember on
Monday. It lands in `notes/<YYYY-MM>.md`, one block per day, and search (`⌘/Ctrl+F`)
covers it:

```markdown
# Notes 2026-07

## 2026-07-01

Kickoff with Globex. They want the uploader before the demo.

- chase the SSO ticket

## 2026-07-16

Export queue prototype. Renders, doesn't paginate yet.
```

A day starts at a `## ` heading whose whole content is a date, so the note itself
can use `##` and `###` headings freely — `## Scripts` and `## 2026-07-16 planning`
are both prose. The one exception is a line that is *exactly* `## <YYYY-MM-DD>`
inside a fenced code block: that still reads as the start of a new day.

### Recurring tasks

Add a `repeat:` line and the task stops disappearing when you complete it — its
`due` date rolls onto the next occurrence and a snapshot of the one you just
finished is appended to the archive:

```markdown
## Send the monthly invoice reminder
- id: t_rc3ccc
- status: open
- due: 2026-07-31
- repeat: monthly on last
- repeatFrom: schedule
- repeatUntil: 2026-12-31
- lastDone: 2026-06-30
```

| Line | Meaning |
| --- | --- |
| `repeat:` | `daily`, `weekdays`, `every 3 days`, `weekly on mon,thu`, `every 2 weeks on thu`, `monthly on 15`, `monthly on last`, `yearly on 03-14` |
| `repeatFrom:` | `schedule` (default) counts from the series, so missing one occurrence doesn't move the rest. `completion` counts the interval from the day you actually finished it. |
| `repeatUntil:` | Last date of the series. Completing the final occurrence closes the task for good. |
| `lastDone:` | Written automatically on each completion. |

Archived occurrences carry `repeatOf: <task id>` and get their own id, so the
history is queryable and no two blocks ever share an id. Nothing runs in the
background: the next occurrence is computed at the moment you tick one off.

### Overdue

A task is **overdue** when its `due:` date is behind the day being looked at and
nothing has closed it. That is a comparison, not a job — nothing scans in the
background, and no state is written to your Markdown.

It matters most for recurring tasks. A `schedule` rule only rolls its `due` date
forward when an occurrence is *completed*, so an invoice set to `monthly on 1`
that fell on a Saturday still reads as due the 1st on Monday morning. By then no
day matches its rule any more, so "due this day" can't show it — the overdue
block is what keeps it in front of you until it's actually done.

Overdue tasks surface in four places: an **Overdue** block at the top of the day
overview (judged against the day you're viewing), the **Overdue** view in the nav
(judged against today, grouped by client), a red count badge on that nav item, and
— on an installed app — a badge on the icon itself, counting overdue plus due today.
A task that is both overdue and lands on the day you're viewing is shown once, as
overdue. Due-date chips on task rows turn red and gain the lag — `1 Aug · 3d`.

---

## How it works

The app is layered so that nothing but the outermost ring knows about GitHub:

- `src/model`, `src/parser`, `src/util` — the pure task/worklog parser & serializer.
- `src/ui` — the React dashboard (Day / Calendar / Clients / Archive / Insights).
- `src/services`, `src/commands/shared` — the mutation services, writing into an in-memory
  file map rather than to disk.
- `src/server`, `src/pages/api` — the GitHub-backed host: OAuth session, load, and commit.
- `src/workspace`, `src/data`, `src/db`, `src/store.ts` — the in-memory file store and cache
  (no WASM, no disk).

**Read path:** GitHub → load files → parse → in-memory store → React dashboard.
**Write path:** dashboard → services → in-memory Markdown → debounced commit → GitHub.

The GitHub token lives in an httpOnly cookie and is used only by the server-side `src/pages/api/*`
routes — it never reaches browser JS. That is why the app runs with SSR.

## Project structure

```
src/
  pages/
    index.astro          # landing / "Sign in with GitHub"
    app/                 # the dashboard (mounts the React island)
    api/
      auth/{login,callback,logout}.ts   # OAuth code flow + cookie session
      user.ts, repos.ts, load.ts, commit.ts, init.ts   # token-proxied GitHub calls
  server/
    github.ts            # server-side GitHub REST/Git Data client
    session.ts           # cookie + env helpers
  ui/                    # the React dashboard: WebApp/WorklogApp, views, components
  model/ parser/ util/   # pure task/worklog logic
  services/ commands/    # mutation services
  workspace/ data/ db/ store.ts   # in-memory file map + index + store
test/roundtrip.test.ts   # golden round-trip tests
```

## Troubleshooting

- **"GITHUB_CLIENT_ID is not configured."** — `.dev.vars` is missing or the dev server was started
  before it existed. Create it and restart `npm run dev`.
- **Redirected back to the sign-in page / "Invalid OAuth state."** — the callback URL in the OAuth
  App must exactly match `http://localhost:4321/api/auth/callback` (or your prod URL). Also check
  the system clock and that cookies are allowed.
- **"Couldn't open this repository."** — the repo lacks a Worklog layout (a `.worklog/config.json`
  plus `clients/`, `worklog/`, `archive/`), or the branch name is wrong. Pick another repo or add
  the files first.
- **Repo list is empty or a repo 404s on commit** — you didn't grant the `repo` scope. Sign out and
  back in, and approve the requested permissions.
- **An image shows as its alt text** — the bytes aren't on the device. Either you're offline (the
  cached repo holds your Markdown, not the images — see Working offline), or the Markdown came from
  somewhere else and points at an `assets/` file this repo doesn't have.

## Known limitations

- Single user, one repo mounted at a time. Commits three-way merge per record before pushing (see
  Saving), so concurrent edits to different tasks, days or clients all survive; the same record
  changed in two places at once resolves to your version, with a notice.
- Inline images render from the copy held in memory, so a pasted image appears straight away and
  private repos work the same as public ones — but an image is only visible on a device that has
  the repo's bytes, which is why an offline open falls back to alt text.
- Images added to a task or a note are never cleaned up: deleting the task or note leaves the file
  in `assets/`, to be removed by hand if you want the space back. (Attachments are the exception —
  deleting one removes its file too, though Git history still holds the bytes.)
- Scaffolding writes the Worklog layout only where it is missing: files that already exist in the
  target repo are left as they are.
- A task deeplink opened without a session is dropped rather than resumed after signing in — the
  app redirects to the sign-in page and the query goes with it.
