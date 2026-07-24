# Worklog Web

A standalone, GitHub-backed web app for managing a **Worklog** timesheet — the same
Markdown format used by the [vscode-worklog](https://github.com/estruyf/vscode-worklog)
extension, without needing VS Code. Sign in with GitHub, pick the repo that holds your
timesheet, and manage tasks, time entries, clients, archiving and insights. Every edit is
committed straight back to your repo. **Markdown is the source of truth.**

## How it works

The extension's data logic and its React dashboard were ported almost verbatim:

- `src/model`, `src/parser`, `src/util` — the pure task/worklog parser & serializer (unchanged).
- `src/webview` — the extension's React dashboard (Day / Calendar / Clients / Archive / Insights),
  with the only VS Code seam (`vscodeApi.ts`) swapped for an in-process bridge.
- `src/services`, `src/commands/shared`, `src/views` — the mutation services, adapted to write
  into an in-memory file map instead of `vscode.workspace.fs`.
- `src/host` — the new GitHub-backed host: OAuth session, load, and commit.
- `src/workspace`, `src/db`, `src/store.ts` — an in-memory replacement for the SQLite cache and
  file I/O (no WASM, no disk).

Data flows: **GitHub → load files → parse → in-memory store → React dashboard**. Edits go
**dashboard → services → in-memory markdown → debounced commit → GitHub** (direct commit to the
branch, no PR). A moved branch head returns `409` and the client re-bases its commit.

The GitHub token lives in an **httpOnly cookie** and is only ever used by the server-side
`src/pages/api/*` routes — it never reaches browser JS. That's why this is an SSR app.

## Setup

1. **Create a GitHub OAuth App** at <https://github.com/settings/developers>:
   - Homepage URL: `http://localhost:4321` (and your prod URL later)
   - Authorization callback URL: `http://localhost:4321/api/auth/callback`
   - Scope used: `repo` (read/write private timesheet repos) + `read:user`.

2. **Local env:** copy `.dev.vars.example` → `.dev.vars` and fill in `GITHUB_CLIENT_ID` /
   `GITHUB_CLIENT_SECRET`.

3. **Run:**
   ```bash
   npm install
   npm run dev        # http://localhost:4321
   npm test           # golden round-trip tests over a real timesheet repo
   ```
   Point the tests at any timesheet with `WORKLOG_DATA_DIR=/path/to/repo npm test`.

## Deploy (Cloudflare)

```bash
npm run build
npx wrangler deploy
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put APP_BASE_URL       # e.g. https://worklog.example.com
```

Then add the production callback URL (`https://<your-domain>/api/auth/callback`) to the OAuth App.

## Repo layout expected

```
.worklog/config.json         # clients, statuses, hoursPerDay, weekStart
clients/<id>.md              # open tasks
archive/<client>/<YYYY-MM>.md  # closed tasks
worklog/<YYYY-MM>.md         # time entries: - <date> <clientId|event:type> <hours>
assets/                      # images pasted into task notes
```

## Status / known limitations

- Single user, one repo mounted at a time; commits are last-write-wins with a reload-and-retry
  on branch conflicts (no rebase/merge).
- Images in task notes resolve via `raw.githubusercontent.com`, so freshly-pasted images render
  only after the next sync (and public-repo raw URLs). Private-repo inline image auth is a follow-up.
- Scaffolding a brand-new empty repo from the UI is not wired yet — point it at a repo that already
  has the Worklog layout (or create the files once with the extension).
