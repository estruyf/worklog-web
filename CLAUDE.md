# CLAUDE.md

Worklog Web — a GitHub-backed timesheet app. Astro SSR + React islands + Tailwind 4,
deployed to Cloudflare Workers. **Markdown in the user's repo is the source of truth.**

[README.md](README.md) documents the product, the setup and the repo format the app reads.
Read it before changing anything user-facing. This file covers how to work in the codebase.

---

## Working principles

These come before the project-specific rules below. Adapted from
[andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md).

- **Think before coding.** Don't assume, don't hide confusion, surface tradeoffs. State the
  assumption you're working under; if a request has two readings that produce different code,
  say both rather than silently picking one. The invariants here are the kind a wrong guess
  breaks quietly — the merge record keys, the serializer half of a parser change, the single
  terminal status.
- **Simplicity first.** The minimum code that solves the problem, nothing speculative. No
  unrequested features, no single-use abstraction, no error handling for cases that can't occur
  in this app (one person's timesheet, no disk, nothing in the background). If it could be
  substantially shorter, rewrite it.
- **Surgical changes.** Touch only what you must; clean up only your own mess. Match the style
  of the file you're in. Code your change orphaned goes; pre-existing dead code stays. The
  rough edges in [docs/code-audit.md](docs/code-audit.md) are known and deliberate — don't
  drive-by fix them.
- **Goal-driven execution.** Turn a vague request into a criterion you can check, then loop
  until it holds. Here that criterion is concrete more often than not: a failing test that
  passes, the four commands below all clean, the round-trip test still byte-faithful.

---

## Commands

```bash
npm run dev      # http://localhost:4321 (needs .dev.vars — see README step 2)
npm test         # vitest, 538 tests / 34 files — must stay green
npm run lint     # eslint, 0 errors AND 0 warnings expected
npx tsc --noEmit # must be clean
npm run build    # astro build → dist/server (worker) + dist/client (assets)
```

**Run all four before calling work done.** `npm run build` is not optional for UI changes:
Tailwind only emits classes its `@source` scan finds, so a class assembled by string
concatenation at runtime compiles fine, types fine, lints fine — and ships with no CSS.

`npm run check` (`astro check`) is **broken on a clean checkout** — `@astrojs/check` is not in
devDependencies, so it prompts interactively. Use `npx tsc --noEmit` instead.

Tests run against the fixture repo in `test/fixtures/timesheet` (no network, no auth).
`WORKLOG_DATA_DIR=/path/to/repo npm test` runs the same assertions over a real timesheet.

Finishing a change includes a one-liner in [CHANGELOG.md](CHANGELOG.md) under today's date
(`YYYY-MM-DD`, newest day on top) — what it means for someone using the app, not a restated
commit message. Add the heading if the day has none; add to it if it's already there.

---

## Architecture — the layering is the point

Dependencies flow one way. Nothing below the line knows about GitHub; nothing above it
knows about React.

```
parser/ model/ util/     pure markdown ⇄ Task/WorklogEntry. No I/O, no React.
workspace/ db/ store.ts  in-memory FileMap ("the filesystem"), MemoryDb, rebuild
services/ commands/      mutations — write into the FileMap, never to disk or network
data/                    worklogStore: sync, three-way merge, IndexedDB recovery + offline
ui/                      React dashboard (primitives → components → views)
server/ pages/api/        ─── the only ring that talks to GitHub ───
```

Hold this line. A service must not import React; the parser must not import a service; the
UI must not reach past `data/` to `server/`.

### The write path, end to end

`UI action → services/* → FileMap.writeText() → store.rebuild() → onDidChange →
worklogStore derives state + arms the debounced committer → /api/commit → GitHub`.

Every edit re-parses the whole file map (`workspace/indexer.ts`). That is deliberate for now —
the dataset is one person's timesheet. Don't add caching there without a measurement.

### Auth

The GitHub token lives in an httpOnly + Secure + SameSite=Lax cookie and is read **only** by
`src/pages/api/*`. It must never reach browser JS — that is why the app is SSR at all. Any new
GitHub call gets a server route; never a `fetch` to `api.github.com` from a component.

---

## Rules that are easy to break

### 1. Markdown round-trip must stay faithful

`test/roundtrip.test.ts` parses and re-serializes the fixture repo and asserts byte fidelity.
This is what keeps commits diff-clean and the user's Markdown portable and hand-editable.

Adding a field to `Task` means touching all of these, in order:

1. `src/model/types.ts` — the type
2. `src/parser/taskParser.ts` — parse the `- key: value` meta line **and** serialize it back,
   in the same position
3. `src/data/merge.ts` — nothing, if the record key is unchanged (see below)
4. `src/services/taskOps.ts` / `tasks.ts` — the mutation
5. `test/fixtures/timesheet/**` — a fixture carrying the new field
6. a test

Skipping step 2's serializer half is the classic failure: it parses, it renders, and it
silently drops the field on the next commit.

### 2. The merge is by record, never by line

`src/data/merge.ts` three-way merges structurally so conflict markers can never land in
Markdown the parser would choke on. Record keys:

| File | Key |
| --- | --- |
| `clients/*.md`, `archive/**.md` | the task's `- id:` |
| `worklog/*.md` | date + client id |
| `.worklog/config.json` arrays | entry `id` |

One-sided change wins (including deletion); both-sided keeps local and notifies. Remote
ordering is preserved so a merged file stays a small diff.

Any new file kind under a synced path needs a merge strategy, or it will resolve
last-writer-wins. `test/twoInstances.test.ts` is the pattern for proving a sync scenario —
write one there for anything touching sync, recovery or merge.

### 2a. What the device holds is two halves, and they must stay apart

`data/repoCache.ts` keeps the branch as last seen; `data/pendingStore.ts` keeps the edits that
haven't reached GitHub. An offline open layers the second over the first through the *same*
`applySnapshot` merge an online open uses over a fresh `/api/load` — that is the only reason one
merge serves both paths. Don't collapse them into one record: the cache is written from
`FileMap.baseText` (the branch), never from what is on screen, which is what keeps it free of the
dirty/clean ambiguity.

Both go through `data/idb.ts` — one module owns the database, because one database can only be
opened at one version. Adding a store means bumping `DB_VERSION` there and *adding* to
`onupgradeneeded`, never replacing it: users arrive at the new version from every older one.

`test/offline.test.ts` covers the cold start, and hand-rolls IndexedDB in `test/helpers/` rather
than taking a dependency, so `npm test` still needs no network and nothing installed.

### 2b. Statuses are the user's list, and exactly one of them closes a task

`config.statuses` is editable in Settings, so nothing may assume the shipped ids.
`normalizeStatuses()` in `src/model/status.ts` is what every reader relies on: valid entries
only, unique ids, and **exactly one `terminal` status, always last**. `terminalStatusId()` is
the archive trigger and `openStatusId()` is where a new task starts — a config with two
terminal entries or none would make both a guess, so `loadConfig` normalizes on the way in and
every mutation in `src/services/statuses.ts` normalizes on the way out.

A status id lives in the user's Markdown (`- status: waiting-for`). That is why the label is
editable and the id is not, and why `deleteStatus` leaves the tasks using it alone rather than
reassigning them — a removal is a config change, never a bulk edit of task blocks. Those tasks
resolve through `resolveStatusMeta`'s fallback and are listed back under "Still in use" in
Settings. `test/statuses.test.ts` guards all of this.

### 3. UI primitives are style-only

`src/ui/primitives/` knows nothing about tasks or clients. App-aware markup lives in
`src/ui/components/` and composes primitives. Views in `src/ui/views/` are **propless** — they
read from context.

`cn()` is *not* a Tailwind-aware merge. A `className` passed to a primitive can **add**
utilities (layout, margin, width) but cannot reliably **override** the variant's own padding or
colour — CSS source order decides, not attribute order. Reaching for `!` is the signal to add a
variant or tone to the primitive instead.

[docs/ui-primitives.md](docs/ui-primitives.md) is the full audit and migration record.

### 4. React hooks lint warnings are load-bearing

The UI keeps long-lived `window` listeners that deliberately never re-subscribe, with values
routed through refs. `exhaustive-deps` is the only thing that catches the one that isn't — a
shortcut handler once froze `view` at its mount value that way. **Zero warnings, not just zero
errors.** See the comment at the top of `eslint.config.js`.

### 5. Cloudflare Workers is the runtime, not Node

- `react-dom/server` must resolve to `server.edge` — in dev as well as builds, since
  `@astrojs/cloudflare` v14 runs the real workerd in dev too. `server.browser` uses
  `MessageChannel`, which does not exist in Workers, and it fails **at deploy**, not at build.
  See the comment in `astro.config.mjs` before touching `vite.resolve`.
- **One Vite copy, matching Astro's.** `@cloudflare/vite-plugin` binds whichever `vite` it
  resolves; if that is not the one Astro runs, its module runner talks the wrong protocol to
  the dev server and workerd dies at startup with `Missing field \`moduleType\`` — before any
  of your code runs. That is why `vite` is a direct devDependency pinned to Astro's major:
  a transitive dep pulling in an older Vite (vitest 3 did) silently re-splits it. `npm ls vite`
  must show one deduped version.
- Env and bindings come from `import { env } from 'cloudflare:workers'` (see
  `src/server/session.ts`); `Astro.locals.runtime.env` was removed in Astro 6 and its getter
  now throws. Types for it are hand-declared in `src/env.d.ts` — and `skipLibCheck` means
  mistakes there are invisible to `tsc`.
- Subrequests are capped per request (50 free / 1000 paid). `loadRepo` and `commitFiles` fan out
  one request per file — bound any new fan-out.
- No Node APIs, no disk. `src/db/memoryDb.ts` and `src/workspace/paths.ts` exist because of this.

### 6. Security posture

- `src/middleware.ts` builds the CSP by hashing the inline scripts in the actual response, so
  it can't rot on an Astro upgrade. Adding an external host means editing the policy — and
  justifying it, on a page that holds a `repo`-scoped session.
- `isWorklogPath()` in `src/server/github.ts` gates **both** read and write. The commit path
  must never accept an arbitrary client-supplied path — `.github/workflows/*` would be CI
  execution in every repo the user owns. `test/commitPaths.test.ts` guards this.
- Three `dangerouslySetInnerHTML` sites are fed by the hand-rolled renderer in
  `src/ui/utils/markdown.ts`. Escape before assembling attributes; the CSP is a backstop, not
  a licence. New Markdown surfaces go through `src/ui/components/MarkdownView.tsx` — the
  shared one — rather than adding a fourth. (The other two are `NotesSection` and
  `ClientInfoCard`; the latter renders with no image resolver, so `assets/` refs there fall
  back to alt text.)
- `src/ui/deeplink.ts` is the one place untrusted input enters the model: `/app/new?title=…`
  can be opened by any page, and a `web+worklog:` link the browser hands over arrives at the same
  route as `?handler=<escaped url>` — one parser for both, because the scheme URL's query *is* the
  deeplink query. `DEEPLINK_SCHEME`/`DEEPLINK_HANDLER_URL` and `protocol_handlers` in the manifest
  must keep naming the same scheme and URL; a test asserts they do. A share from the OS share sheet
  is the third entry and still the same parser — `share_target` renames the share's fields onto
  params `parseTaskDeeplink` already reads (`SHARE_TARGET_PARAMS`), so a mapping pointed at anything
  else is silently dropped by the router's strip; the same test pins it. The manifest is the *only*
  claim on the scheme — don't reintroduce `registerProtocolHandler`, which claims it for the
  browser, outranks the installed app on macOS, and can't be released on Chromium (the header
  comment in `deeplink.ts` records why). It sanitizes to what `serializeTask` can round-trip — one line per
  title/label, no control characters, http(s)/mailto only, length caps. A new field on
  `TaskFormSeed` that a deeplink can set gets the same treatment, or a link's `url` becomes an
  href nobody vetted. It fills the form and nothing else: there is no unauthenticated write path,
  and adding one would be a different decision entirely.

---

## Style

- **Comments explain *why*, not *what*.** This codebase's comments record decisions that would
  otherwise be re-litigated — the Vite `resolve.conditions` scoping, per-browser-instance
  snapshot keys, the layered-Escape guard in `Modal`. Match that. Don't narrate the code.
- File-top comments state what the module owns and who is allowed to call it. New modules get one.
- Dates are `YYYY-MM-DD` strings throughout; local-time helpers live in `src/util/date.ts`.
  Never `new Date(str)` on a date-only string — it parses as UTC and shifts the day.
- Nothing runs in the background. "Overdue" is a comparison, not a scan; the next recurrence is
  computed when you tick one off. Keep it that way — no scheduled state written into user Markdown.

## Known rough edges

Recorded in [docs/code-audit.md](docs/code-audit.md) (2026-07-30). Live ones worth knowing:

- `src/pages/index.astro` is 1263 lines with ~660 lines of hand-written `<style>` in a project
  that has Tailwind and a primitives layer. It is the one file that ignores the rules.
- One `DataContext` with ~60 keys and one `React.memo` in the whole UI: everything re-renders on
  every edit. The `src/ui/hooks/model/*` split defines the seams to split the context along.
- `src/server/*` and `src/pages/api/*` have no tests, including a `force: true` ref update.
- `tsconfig.json` `paths` still point at `src/worklog-core`, `src/host`, `src/webview` — leftovers
  from the VS Code extension this grew out of. No such directories exist.

**Settled — do not re-raise:** the `api.visitorbadge.io` pixel in `src/ui/WebApp.tsx` and
`src/pages/index.astro` is a service the repo owner runs. `docs/code-audit.md` lists it as its
top finding; that finding is resolved as accepted, not outstanding.
