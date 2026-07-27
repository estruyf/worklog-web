# Worklog Web

A standalone, GitHub-backed web app for managing a **Worklog** timesheet — the same Markdown
format used by the [vscode-worklog](https://github.com/estruyf/vscode-worklog) extension, without
needing VS Code. Sign in with GitHub, pick the repo that holds your timesheet, and manage tasks,
time entries, clients, archiving and insights. Every edit is committed straight back to your repo.
**Markdown is the source of truth.**

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
8. [Testing](#testing)
9. [Deploying to Cloudflare](#deploying-to-cloudflare)
10. [Environment variables](#environment-variables)
11. [Expected repository layout](#expected-repository-layout)
12. [How it works](#how-it-works)
13. [Project structure](#project-structure)
14. [Troubleshooting](#troubleshooting)
15. [Known limitations](#known-limitations)

---

## Prerequisites

- **Node.js 20+** and npm.
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

The dashboard mirrors the VS Code extension:

- **Day** — the default view. Log time for the selected day (full day, half day, or custom
  hours), or log a non-client **event** (vacation, out-of-office, …). See open, due, worked, and
  done tasks for that day; mark a task worked, cycle its status, or close it.
- **Calendar** — a month grid of logged time; click a day to jump to it, or plan a task with a
  due date.
- **Clients** — every client and its open tasks. Create/edit clients (name + accent colour), add
  tasks with links, tags, due dates, descriptions and subtasks. Retire a client you no longer work
  with by **archiving** it: it drops out of the pickers, the Day view and the log form, while every
  task and logged hour stays put and keeps reporting. Archived clients are listed (and restored)
  under the client list. **Delete** is offered only for a client with no tasks and no logged time —
  anything else would orphan billing history, so archive that instead.
- **Archive** — closed tasks by client/month; reopen one to move it back to its client file.
- **Insights** — per-client hours and derived days for a month, an events breakdown, and a monthly
  trend chart.

**Saving:** edits are written to an in-memory copy of your Markdown immediately, then committed to
GitHub automatically about a minute after your last change. Click the **sync** button in the top
bar to commit right away. Commit messages match the extension's format:
`chore: worklog sync <date>`.

**Tags:** the task form picks from the tags already in use — type to filter them, `↑/↓` and `↵` to
choose, and **Create "…"** appears only when nothing existing matches, so the vocabulary doesn't
drift into typos. A re-spelling folds onto the tag that exists (typing `Mobile` reuses `mobile`).

A tag chip is also a filter wherever it appears — click one on a task, in the detail panel or in a
search hit to see every task carrying it, open and archived. Search (`⌘/Ctrl+F`) has a tag row of
its own: pick one or more tags (a task must carry all of them) with or without a query.

**Keyboard shortcuts:** `⌘/Ctrl+N` new task · `⌘/Ctrl+F` or `⌘/Ctrl+S` search · `⌘/Ctrl+L` log time
(Day view) · `⌘/Ctrl+R` reload from GitHub · `Esc` close the top dialog.

---

## Testing

The test suite parses and re-serializes a **real** timesheet repo and asserts the round-trip is
faithful — this is what guarantees commits stay diff-clean and interoperable with the extension.

```bash
npm test                                   # uses /Users/<you>/Developer/timesheet by default
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
.worklog/config.json           # clients, statuses, hoursPerDay, weekStart
clients/<id>.md                # open tasks
archive/<client>/<YYYY-MM>.md  # closed tasks
worklog/<YYYY-MM>.md           # time entries: - <YYYY-MM-DD> <clientId|event:type> <hours>
assets/                        # images pasted into task notes (optional)
```

A task block looks like:

```markdown
## Fix the mobile picker
- id: t_awxnyh
- status: in-progress
- link: https://example.com/task/123
- created: 2026-06-30
- due: 2026-07-05
- worked: 2026-06-30
- tags: mobile, bug

Free-form description in Markdown.

### Notes
- 2026-06-30 14:12 — Reproduced on iOS Safari.
```

---

## How it works

The extension was cleanly layered, so this is mostly a **port, not a rewrite**:

- `src/model`, `src/parser`, `src/util` — the pure task/worklog parser & serializer (unchanged;
  only `ids.ts` swapped Node crypto for Web Crypto).
- `src/webview` — the extension's React dashboard (Day / Calendar / Clients / Archive / Insights).
  The only VS Code seam, `vscodeApi.ts`, now re-exports an in-process bridge.
- `src/services`, `src/commands/shared`, `src/views` — the mutation services, adapted to write into
  an in-memory file map instead of `vscode.workspace.fs`.
- `src/host` — the new GitHub-backed host: OAuth session, load, commit, and the message bridge.
- `src/workspace`, `src/db`, `src/store.ts` — an in-memory replacement for the SQLite cache and file
  I/O (no WASM, no disk).

**Read path:** GitHub → load files → parse → in-memory store → React dashboard.
**Write path:** dashboard → services → in-memory Markdown → debounced commit → GitHub.

The GitHub token lives in an httpOnly cookie and is used only by the server-side `src/pages/api/*`
routes — it never reaches browser JS. That is why the app runs with SSR.

## Project structure

```
src/
  pages/
    index.astro          # landing / "Sign in with GitHub"
    app.astro            # the dashboard (mounts the React island)
    api/
      auth/{login,callback,logout}.ts   # OAuth code flow + cookie session
      user.ts, repos.ts, load.ts, commit.ts   # token-proxied GitHub calls
  components/
    WebApp.tsx           # island: session → repo picker → dashboard
    RepoPicker.tsx
  host/
    github.ts            # server-side GitHub REST/Git Data client
    session.ts           # cookie + env helpers
    bridge.ts            # in-process replacement for the webview<->host bus
  webview/               # the ported React dashboard (see above)
  model/ parser/ util/   # ported pure logic
  services/ commands/ views/   # ported mutation services + snapshot + handler
  workspace/ db/ store.ts      # in-memory file map + index + store
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
- **A pasted image doesn't show immediately** — inline images resolve via `raw.githubusercontent.com`
  and only appear after the next sync (and for public repos); see limitations.

## Known limitations

- Single user, one repo mounted at a time; commits are last-write-wins with a reload-and-retry on
  branch conflicts (no rebase/merge).
- Inline images resolve via `raw.githubusercontent.com`, so freshly-pasted images render only after
  the next sync, and private-repo inline image auth is a follow-up.
- Scaffolding a brand-new empty repo from the UI is not wired yet — point the app at a repo that
  already has the Worklog layout (or create the files once with the extension).
