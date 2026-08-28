# The Worklog promo videos

Two cuts, both [Remotion](https://www.remotion.dev) — React rendered to frames,
so the timeline is a table of frame numbers in a `.tsx` file and changing the
pace is changing a number and re-rendering.

| Composition | | |
| --- | --- | --- |
| `Promo` | 30s | The pitch. A day, filling in the gap, the Markdown that wrote, the commit |
| `Tour` | 90s | Every screen. Day, overdue, upcoming, to-dos, calendar, clients, a task, writing one, closing one, archive, insights, search, statuses, sync, the files, a phone |

Nothing here is part of the app. It has its own `package.json` and its own
dependencies, and the deployed Worker still has none of them.

## Building them

```bash
npm install
npm run assets                       # the app icon and one demo file into public/

# in the repo root, in another shell — the capture needs the app served
npm run build && npm run preview     # http://localhost:4321

npm run capture                      # every still and every recorded beat, retaken
npm start                            # the Remotion studio, with a scrubbable timeline
npm run render                       # out/worklog-promo.mp4  — 1920x1080, 30 fps, ~7 MB
npm run render:tour                  # out/worklog-tour.mp4   — same shape, ~23 MB
npm run web                          # the copies the landing page serves
```

`npm run web` writes `public/video/` **in the app**, not here: the 30-second cut
at 1080p, the tour at 720p, and a poster. Those three files are what
`src/pages/index.astro` points at. The masters in `out/` are what to upload
anywhere that re-encodes for you — YouTube, LinkedIn, Bluesky.

## Where the pictures come from

Everything on screen is the real app, running, driven by Playwright. Nothing is
a mock-up and nothing is a design of a screen the app does not have.

`scripts/harness.mjs` opens `/app` with `/api/*` answered from disk instead of
from GitHub, so there is no account, no token and no network in any of it. The
gate on `/app` only checks that a session cookie exists; every route that would
verify it — `user`, `repos`, `load`, `head`, `commit` — is intercepted. The
clock is pinned to **2026-08-27**, which is the day every date in `demo/` is
written against, so "Thu 27 Aug 2026" and the overdue counts come out the same
on every run.

`demo/` is a complete Worklog repository in the layout the README documents:
three clients and one archived one, a to-do list with four recurrences, three
months of ledger, day notes, an archive, and a `.worklog/config.json` with five
statuses. **It is the only data any of this touches.** A real timesheet has real
client names in it, and those are hard to take back out of a video.

Two things in that config are chosen for the camera rather than for taste, and
both are settings a person could reasonably have:

- **`autoSync.events` is empty and the delay is a minute**, so an edit sits
  unsent for the length of a clip instead of being committed out from under the
  shot. With the shipped defaults the sync beat would have nothing to push by the
  time the pointer got there.
- **The status list has five entries**, because "Waiting for" and "In review"
  sitting alongside the shipped three is the whole point of the statuses scene.

### Stills

`public/shots/*.png`, one per screen, at 2x. `capture.mjs` drives the app to each
one, parks the pointer somewhere nothing reacts to it, and shoots. The parking
matters: hiding the cursor is not enough, because the row it was left on keeps
its hover state, and on a task row that swaps the title for a rail of buttons.

The task detail is opened by its route rather than by clicking the row it sits
on. Clicking is what a person does, but that row also carries an expander and a
rail of actions that appear under the pointer, and which of them a click lands on
depends on where the row happens to be.

### Recorded beats

`public/clips/*.mp4`, four of them: time logged, a task written, a task closed, a
commit. Each is `{ prepare, run }` — only `run` is recorded, so a clip never
opens on two seconds of the page settling that the cut would have to throw away.

They are captured through CDP's `Page.startScreencast`, which emits a frame when
the page paints and not otherwise. `record()` resamples that variable-rate stream
onto a fixed 30 fps grid before handing it to ffmpeg, which is what makes a frame
number in the Remotion timeline mean a fixed number of milliseconds.

Two things about that API are worth knowing before changing any of it:

- **It composites at CSS resolution and ignores the context's
  `deviceScaleFactor`**, so without `--force-device-scale-factor=2` on the
  browser every beat comes back at 1280x820 and has to be upscaled to sit beside
  the 2x stills. Inflating the viewport instead — `zoom` on the root, a 2560px
  window — gets the resolution and breaks the layout: the sidebar's lower half is
  positioned in `vh` and ends up below the bottom of every shot.
- **It does not draw the pointer.** A recording of a click is otherwise a
  recording of something happening for no visible reason, so `harness.mjs` puts a
  dot back at the position the browser is reporting. It follows real mouse events
  rather than a scripted path, so it cannot drift away from where the click lands.
  It is the only thing in any frame that the app did not draw.

`public/clips.json` records how long each recording is, and `Clip` reads it. That
is deliberate: a beat re-recorded a second slower would otherwise cut before its
own payoff, and nothing in the composition would say so.

## How a shot is put together

Each recorded beat **holds** on its first frame while the caption is read,
**plays** at somewhere between two thirds and full speed, and holds again where
it comes to rest — see `Beat` in
[`src/components/Shot.tsx`](src/components/Shot.tsx). Slowing a whole shot down
instead would make the pointer crawl; holding at the ends buys reading time
without touching the pace of the part where something happens.

The camera is a crop. [`src/components/Framed.tsx`](src/components/Framed.tsx)
takes a rectangle in the capture's own 2560x1640 — the numbers you would read off
a file in `public/shots` in Preview — and scales the picture under a window that
clips it. Stills and recordings share that coordinate space, so a crop measured
once works for both.

Shots sit on one of two stages, and both cuts use the same two so a cut between a
screenshot and a recording does not shift the picture sideways:

- **`wide`** — caption above, picture the width of the frame. For the whole
  window (0.94x of the app's own pixels), and for the crops that are wider still:
  a status picker over a list at 2.4x, the settings pane cropped to the status
  list at 1.5x, the to-do list at 1.4x.
- **`side`** — caption in a column on the left, picture nearly the height of the
  frame. For everything taller than it is wide, which since the task lists became
  tables is most of the app: a list now runs to the bottom of the window, so the
  only crop edge below it that isn't slicing a row in half is the window's own,
  and a full-height crop lands at 1.17x.

That last constraint is worth stating plainly, because it decided the framing of
the piece. The log beat used to crop to the day card alone at 1.55x. It worked
while the form was open and fell apart the moment it closed: the card shrinks
back, the open-task table slides up into the frame, and the crop's bottom edge
lands in the middle of a row — showing the app's own ellipsised column headers,
of all things, right after a caption about clarity. There are 23 pixels of gap
below that card in the payoff state and the form is 190 taller than that, so no
single crop frames both halves. The window's own bottom edge is the one that is
clean in both, which is why the side stage is now as tall as it can be drawn.

[`Spotlight`](src/components/Spotlight.tsx) points at one control by dimming
everything else. Its rect is in the capture's own pixels, measured once off the
PNG. It carries no label: the row it points at already explains itself, and the
caption beside the card says the same thing in the piece's words.

## Rules that matter

- **The app is never retouched.** No invented UI, no edited screenshot, no
  number typed into a picture. The claims in a caption are ones the app makes on
  screen in the same shot. The drawn pointer is the single exception, and it is
  there because the capture API drops something the screen really showed.
- **The palette is the app's**, from `src/pages/index.astro` and from the demo
  clients' own accent colours. The ink ground is the one addition: Worklog is
  light, and a white window on a near-white backdrop has nothing to sit on.
- **Every crop edge falls inside the app, or is the window's own edge.** A card
  with its top border scrolled off reads as a mistake; a crop that starts inside
  one reads as a zoom. That is why the log beat scrolls the day card up and then
  backs off by a hundred pixels.
- **They read without sound.** Set `MUSIC` in `src/theme.ts` to a file in
  `public/` and it plays under both, fading in and out over a second at each end.
  Left `null` the render is silent, which is what a video autoplaying on a
  landing page wants.
- **The copy sounds like the README.** Plain, specific, no marketing. A caption
  that could go on a landing page for anything else is the wrong caption.

## Re-cutting

Re-recording a beat does not need the timeline touched — `clips.json` carries the
length and `Clip` reads it. What does need touching, every time, is where a
**caption changes** inside a beat: those are frame numbers in `Promo.tsx` and
`Tour.tsx`, and a caption that says "the day closes at eight of eight" over a
form nobody has pressed Log on yet is the failure. Check one with

```bash
npx remotion still src/index.ts Tour out/check.png --frame=N
```

before spending the minutes on a full render.

Re-anchoring the videos to a different day means moving the dates in `demo/` and
`DEMO_NOW` in `scripts/harness.mjs` together.
