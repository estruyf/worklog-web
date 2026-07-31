# Code audit — 2026-07-30

Full read of the server layer, data/sync layer, parsers, services and UI (~17.8k lines of
source across 184 files), plus the test suite and build tooling.

Findings are grouped as **Good** (worth protecting), **Bad** (real problems, fix these) and
**Ugly** (works today, but the shape will cost you later).

## Contents

- [Status](#status)
- [Health check](#health-check)
- [The Good](#the-good)
- [The Bad](#the-bad)
- [The Ugly](#the-ugly)
- [What is left](#what-is-left)

---

## Status

Fixed on 2026-07-31:

| # | Finding | Change |
| --- | --- | --- |
| Bad 2 | No CSP | `src/middleware.ts` — full policy, hashes computed per response |
| Bad 3 | `/api/commit` accepted any path | `isWorklogPath()` now gates writes; `test/commitPaths.test.ts` |
| Bad 6 | Failed sync never retried | `sync()` re-arms in `finally`; `test/syncRetry.test.ts` |
| — | **Edits during an in-flight commit were silently lost** (found while testing Bad 6) | `markPushed` settles only what shipped |
| Ugly 6 | Byte-at-a-time base64 | 32k chunking; `test/bytes.test.ts` |

Everything else below still stands.

---

## Health check

| Check | Result |
| --- | --- |
| `npx vitest run` | 243 passed, 18 files (was 228 / 15) |
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean (0 warnings) |
| `npx astro build` | clean |
| CSP enforcement | verified in headless Chrome: island hydrates, no blocked loads; injected inline and external scripts are refused |
| `npm run check` | **broken** — `astro check` prompts to install `@astrojs/check`, which is not in devDependencies |

The `useWorklogModel` decomposition into `src/ui/hooks/model/*` landed during the audit and
eliminated the 18 `react-hooks/exhaustive-deps` warnings that were present at the start.

---

## The Good

### The layering is real and it holds

`parser → model → services → store → data → ui`, with dependencies flowing one way. No
circular imports, no UI reaching into the parser, no service importing React. At 17.8k lines
that is discipline, not luck.

### The comments explain *why*, and they are right

- `astro.config.mjs:6-12` — why `resolve.conditions` is dev-scoped (Vite 6 would otherwise
  pull `react-dom/server.browser` and its `MessageChannel` into the Workers runtime).
- `eslint.config.js:1-8` — why the config exists at all: a shortcut handler once froze `view`
  at its mount value, and nothing but `exhaustive-deps` catches that.
- `src/data/pendingStore.ts:14-19` — why snapshots are keyed per browser instance rather than
  per repo.

This is top-percentile comment quality. They record decisions that would otherwise be
re-litigated every few months.

### The three-way merge is the standout

`src/data/merge.ts` merges structurally by record key (`- id:` for task blocks, date + client
for ledger lines, `id` for config array entries) rather than by line, so it **never** writes
conflict markers into markdown the parser would choke on. Deletions are respected when
one-sided. Remote ordering is preserved so a merged file stays a small diff against the
branch. Backed by `test/merge.test.ts` and a genuine two-instance integration test in
`test/twoInstances.test.ts`.

### Auth is correctly shaped

Token in an httpOnly + Secure + SameSite=Lax cookie, every GitHub call proxied through
`/api/*`, OAuth state generated with `crypto.randomUUID()` and verified on callback, client
secret never leaving the server. The design goal stated in `src/server/session.ts:1-3` is
actually met.

### `Modal` is better than most component libraries ship

`src/ui/primitives/Modal.tsx` has a real focus trap, focus restore that checks
`opener?.isConnected` (so a search hit that unmounts its own row does not silently drop focus
to `<body>`), and layered-dialog Escape resolution via a `panel.contains(active)` guard. The
reasoning at `Modal.tsx:147-155` is exactly correct.

### Crash recovery is thought through

Per-tab instance IDs in sessionStorage, a legacy v1 object store drained exactly once, every
IndexedDB call resolving quietly on failure (private mode, SSR, quota), and restores that
three-way merge against the branch rather than overwriting it.

---

## The Bad

### 1. Third-party tracking pixel inside the authenticated app

`src/ui/WebApp.tsx:124-132` loads `api.visitorbadge.io` on every load of `/app`. That ships
the IP, User-Agent and referrer of a **signed-in** user to a third party — on the page whose
selling point is "your token stays server-side, never in the browser." It is also an
uncontrolled external host in the app shell.

**Fix:** delete it, or move it to the public landing page where there is no session to leak.

### 2. No CSP, no security headers anywhere — FIXED

Nothing in `src/layouts/Layout.astro`, no middleware, no headers in `wrangler.jsonc`.

There are four `dangerouslySetInnerHTML` sites fed by a hand-rolled regex renderer:

- `src/ui/components/DescriptionEditor.tsx:121`
- `src/ui/components/DescriptionEditor.tsx:123`
- `src/ui/components/task-detail/NotesSection.tsx:57`
- `src/ui/views/clients-view/ClientInfoCard.tsx:19`

No actual escape was found — quotes are escaped before attributes are built, and the link
regex is scheme-restricted to `https?:` / `mailto:`. But the blast radius of the *first* miss
is total, given the token scope below.

**Fixed** in `src/middleware.ts`. Notes for whoever touches it next:

- Astro 5's `experimental.csp` was the obvious route and does not work here — under the
  Cloudflare SSR adapter it emits no policy at all (verified on 5.18, both `csp: true` and
  the object form). It also delivers via `<meta>`, which silently drops `frame-ancestors`.
- Hydrating the React island needs two inline `<script>` blocks that Astro generates, whose
  contents change on any Astro upgrade. Hard-coded hashes would turn a dependency bump into a
  blank page in production, so the middleware hashes the inline blocks of the response it is
  actually sending. `script-src` therefore needs no `'unsafe-inline'`.
- The cost is that HTML responses are buffered rather than streamed. These pages are small
  and render in one pass; revisit if time-to-first-byte ever matters.
- `style-src-attr 'unsafe-inline'` is required: Tailwind arbitrary values and React
  `style={{…}}` props become style attributes, which cannot be hashed. Scoping it to the
  `-attr` directive keeps the exemption off `<style>` elements.
- Three static `<style>` blocks that React rendered at runtime moved into `src/ui/styles.css`
  (`::selection`, the `worklog-slide` keyframes) so they fall under the hashed `style-src`.
- `img-src` allows `https:` because task Markdown may reference any image. That is a
  deliberate hole: it permits CSS/image-based exfiltration. It does not permit script
  execution, and the session token is httpOnly, so `document.cookie` yields nothing.

### 3. `/api/commit` has no path allowlist — `/api/load` does — FIXED

`src/server/github.ts:111-120` defines `isWorklogPath()`, and `loadRepo` filters every blob
through it. `commitFiles` (`src/server/github.ts:174`) accepts whatever `path` the client
sends.

Anything that can reach that endpoint can write `.github/workflows/pwn.yml` into any repo the
user owns — which is code execution in their CI. The write side should be at least as strict
as the read side.

**Fixed.** `isWorklogPath()` is now exported and gates `commitFiles`, which throws
`UnsafePathError` before any request goes out; `/api/commit` maps that to 400. `scaffoldRepo`
is deliberately *not* gated — it writes `README.md` and the `.gitkeep` files that create the
layout in the first place. Covered by `test/commitPaths.test.ts`, including that deletions are
checked (a delete names a path too) and that the guard runs before the network.

### 4. `repo` scope, and a token that is never revoked

`src/pages/api/auth/login.ts:28` requests `scope: 'repo'` — read/write to *all* private repos,
for an app that touches one.

`src/pages/api/auth/logout.ts` only deletes the cookie. It never calls GitHub's token
revocation endpoint, so the token stays valid indefinitely (OAuth App tokens do not expire).

**Fix:** a GitHub App with per-repo installation scopes this to the single timesheet repo. As
a stopgap, revoke on logout.

### 5. Unbounded fan-out vs. Cloudflare's subrequest cap

- `loadRepo` (`src/server/github.ts:152-163`) does `Promise.all` over *every* blob in the tree.
- `commitFiles` (`src/server/github.ts:195-208`) and `scaffoldRepo` create one blob per file
  in parallel.

Workers cap subrequests per request (50 free / 1000 paid). A timesheet that grows to a couple
hundred task files plus assets will hit that ceiling, and it will surface as an opaque GitHub
error rather than a clear limit message.

**Fix:** bound the concurrency.

### 6. A failed background sync never retries — FIXED

In `WorklogStore.sync()` (`src/data/worklogStore.ts:269-275`) the `catch` emits a toast and
`finally` resets the flags — but nothing re-arms `commitTimer`. `scheduleCommit()` is only
ever called from `store.onDidChange`.

Go offline, edit, let auto-sync fire and fail: those dirty files sit unpushed until you make
*another* edit or press Sync manually.

There is a second path to the same stall — `scheduleCommit` (`src/data/worklogStore.ts:519-526`)
early-returns while `this.committing` is true, so an edit landing mid-sync is never scheduled
either.

The IndexedDB snapshot means no data is lost, so this is silent degradation rather than
disaster — but "silent" is the problem for a timesheet.

Related, smaller: that same early-return does not clear an already-armed timer, so turning
auto-sync *off* still lets one pending sync fire.

**Fixed.** `sync()`'s `finally` re-arms whenever anything is still dirty, and
`scheduleCommit` now disarms before deciding, so switching auto-sync off cancels a pending
timer. A failed manual sync with auto-sync *off* deliberately does not self-retry — that stays
the user's move. Covered by `test/syncRetry.test.ts`.

#### 6b. Edits during an in-flight commit were silently lost

Found while writing the test above, and worse than 6 itself.

`pushDirty` builds the commit payload, awaits the network, then called
`markPushed` → `fm.clearDirty()`, which cleared the dirty flag for **every** path — including
one edited after the payload was built. `pushDirty` then called `clearPending()`, deleting the
IndexedDB recovery snapshot as well. The result: an edit made during a sync was dropped from
the next commit *and* from recovery, stayed on screen so nothing looked wrong, and vanished on
the next reload — with the UI reporting everything as synced.

This is very reachable: a sync is a network round trip, and clicking during one is ordinary use.

**Fixed.** `markPushed` now settles only the paths that were actually in the payload, and a
text file only if it still holds exactly what was committed; anything edited in the meantime
stays dirty. `pushDirty` keeps the recovery snapshot and the pending flag when something is
still dirty, and `sync()`'s `finally` arms the retry. The regression test in
`test/syncRetry.test.ts` gates the commit response on the request actually being in flight —
an earlier version of it timed the edit with microtask counting and passed against the broken
code, which is worth remembering if that test is ever rewritten.

### 7. The entire server layer is untested

No test imports `src/server/*` or `src/pages/api/*`. That is 376 lines of `github.ts`,
including the empty-repo bootstrap and a `force: true` ref update at
`src/server/github.ts:352-355` — the single most destructive operation in the codebase,
exercised only by hand.

### 8. Minor

- `GET /api/auth/logout` mutates state (`src/pages/api/auth/logout.ts:11-14`). SameSite=Lax
  blocks the serious vectors, but a non-idempotent GET is free to fix.
- Every dependency is one to two majors behind: astro 5→7, `@astrojs/cloudflare` 12→14,
  `@astrojs/react` 4→6, vitest 3→4, eslint 9→10.
- Server errors return raw GitHub response bodies to the client
  (`src/pages/api/commit.ts:45`).
- `npm run check` does not work on a clean checkout (see [Health check](#health-check)).

---

## The Ugly

### 1. `src/pages/index.astro` — 1263 lines

Roughly 600 lines of markup and **~660 lines of hand-written `<style>`** in a project with
Tailwind 4 wired up, a `src/ui/primitives/` design system, and a 33k-word
`docs/ui-primitives.md`. It is the one file that ignores the codebase's own rules, and it is
7% of total source.

### 2. The markdown renderer regexes over its own output

`src/ui/utils/markdown.ts:43-70`: `inline()` escapes the text, emits `<img src="…">` and
`<a href="…">`, and *then* runs the bold/italic replacements across the whole accumulated
string — including inside the attributes it just wrote.

```
![x](https://a/**b**c)   ->   src="https://a/<strong>b</strong>c"
```

Not exploitable today (quotes are escaped first, so there is no attribute break-out), but it
is structurally wrong: every inline rule added is another chance to corrupt an attribute, and
the correctness argument depends on `escapeHtml` staying ahead of every future rule.

**Fix:** tokenize into text and non-text spans, format only the text spans, then assemble.

### 3. Global mutable mount

`src/workspace/paths.ts:109-122` keeps a module-level `mounted` FileMap that services reach
through free functions, throwing `'No repository is mounted.'` if the order is wrong.

It is why `worklogStore` has to be a singleton, and why testing a service in isolation needs
ceremony instead of a constructor argument. Threading the `FileMap` (or `Store`) explicitly
costs one parameter and deletes a category of ordering bug.

### 4. Full re-parse on every edit

Toggling one checkbox runs `store.rebuild()` → `ws.loadConfig()` (JSON.parse) →
`indexer.rebuild()` (`src/workspace/indexer.ts:18`) walking the entire file map and re-parsing
every markdown file → `deriveState()` rebuilding every array → every `useData()` consumer
re-rendering.

`src/db/memoryDb.ts:1-3` is honest that the dataset is tiny, and it is. But
`src/parser/blocks.ts` already implements surgical block-level replace/extract — the
incremental path exists and nothing uses it.

### 5. One context, ~60 keys, one memoized component

The refactor into seven focused hooks under `src/ui/hooks/model/` is a real improvement and is
what cleaned up all 18 lint warnings. But the composition still spreads them into a single
object behind a single `DataContext`, so its identity changes whenever *anything* changes and
every consumer re-renders on every edit.

There is exactly one `React.memo` in the entire UI
(`src/ui/components/WorklogTaskRow.tsx:105`).

**Next step:** split the context along the same seams the hooks now define.

### 6. Byte-at-a-time base64 on the hot path — FIXED

`src/data/bytes.ts:15-21` builds the string with `+=` per byte. The comment correctly explains
why the spread version blows the argument limit — but the fix is chunked
(`String.fromCharCode(...chunk)` at ~8k), not one byte at a time.

This matters because `persistNow` (`src/data/worklogStore.ts:580-586`) re-encodes **every
dirty binary** on an 800 ms debounce after every edit. With a 10 MB pasted image still
unsynced, every keystroke-batch triggers 10 million string concatenations.

**Fixed.** 32k-byte chunks, joined once. `test/bytes.test.ts` covers the sizes either side of
the chunk boundary and checks the output byte-for-byte against Node's `Buffer` base64 — a
chunking off-by-one would otherwise surface much later as a corrupted image.

### 7. Silent truncation

`listRepos` (`src/server/github.ts:89`) caps at 5 pages (500 repos) and returns quietly.
`loadRepo` drops everything outside `isWorklogPath` without a word. Both should report what
they left out.

---

## What is left

In rough priority order, now that the [Status](#status) items are done:

1. **Drop the tracking pixel** (`src/ui/WebApp.tsx:124-132`). One deletion, and it contradicts
   the product's stated privacy posture. The new `Referrer-Policy` limits what it learns, but
   it still sees the IP of every signed-in user.
2. **Narrow the OAuth scope** (Bad 4). `repo` grants read/write on every repository the user
   owns, for an app that touches one. The CSP now makes an XSS much harder to turn into repo
   access, but the scope is still the thing setting the blast radius.
3. **Bound the GitHub fan-out** (Bad 5). This one is a ceiling the app will grow into, and it
   will present as a confusing error rather than a limit.
4. **Test the rest of the server layer** (Bad 7). `commitFiles` has coverage now; the
   `force: true` ref update in `scaffoldRepo` still has none.
5. Fix `npm run check`, then work through the Ugly list — `index.astro`, the Markdown
   renderer's regex-over-its-own-output, and the global `mountFileMap`.
