// Retakes every picture the videos are cut from, against the demo timesheet in
// ../demo and nothing else.
//
//   node scripts/capture.mjs             everything
//   node scripts/capture.mjs shots       the stills only
//   node scripts/capture.mjs clips       the recorded beats only
//   node scripts/capture.mjs day sync    just those, by name
//
// Needs the app served from somewhere — `npm run build && npm run preview` in
// the repo root, which is the production bundle rather than the dev server's
// (no dev toolbar over the bottom of every shot). Point it elsewhere with
// WORKLOG_URL.
//
// Stills land in public/shots/<name>.png at 2x. Recorded beats land in
// public/clips/<name>.mp4 at a constant 30 fps, with public/clips.json naming
// how long each one is — Remotion reads that rather than carrying a table of
// frame numbers, so re-recording a beat does not mean re-cutting the piece
// around it.

import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL, hidePointer, openApp, settle, showPointer, VIEWPORT } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../public');
const SHOTS_DIR = join(PUBLIC, 'shots');
const CLIPS_DIR = join(PUBLIC, 'clips');
const TMP = join(PUBLIC, '.frames');

export const CLIP_FPS = 30;

// ---- driving the app -----------------------------------------------------

const pause = (page, ms) => page.waitForTimeout(ms);

/** Glide the pointer to the middle of `target`, at something like a hand's
 *  speed. Playwright's default is a teleport, which in a recording reads as the
 *  page having cut rather than someone having moved. */
async function moveTo(page, target, { steps = 26 } = {}) {
  const box = await (target.boundingBox ? target : page.locator(target)).boundingBox();
  if (!box) {
    throw new Error('moveTo: target has no box');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  return box;
}

/** Move, settle for a beat so the hover state reads, then click. */
async function clickOn(page, target, { before = 320, after = 500 } = {}) {
  await moveTo(page, target);
  await pause(page, before);
  await page.mouse.down();
  await pause(page, 90);
  await page.mouse.up();
  await pause(page, after);
}

/** Type at something near a human rate — the app's tag and client pickers
 *  filter as you go, and at Playwright's default that filtering is invisible. */
async function typeInto(page, target, text, { delay = 55 } = {}) {
  await clickOn(page, target, { after: 200 });
  await page.keyboard.type(text, { delay });
}

/// The nav is rendered twice — a rail on a wide window, a drawer behind a
/// hamburger on a narrow one — and only one of them is on screen. Matching by
/// name alone finds both, so every lookup here is filtered to the visible copy.
const nav = (page, name) => page.getByRole('button', { name, exact: true }).locator('visible=true').first();
const newTaskButton = (page) => page.getByRole('button', { name: /New task/ }).locator('visible=true').first();

/** Send the pointer somewhere nothing reacts to it. */
async function park(page) {
  await page.mouse.move(VIEWPORT.width - 6, VIEWPORT.height - 6, { steps: 6 });
  await pause(page, 260);
}

/** Back to a known screen between shots, so one shot's leftovers can't end up
 *  in the next one's picture. */
async function reset(page) {
  await page.keyboard.press('Escape');
  await pause(page, 150);
  await clickOn(page, nav(page, 'Day'), { before: 0, after: 300 });
  // Back to the top as well: a view left scrolled by the shot before puts the
  // next one's subject somewhere it was never framed for.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
    scrollTo(0, 0);
  });
  await park(page);
  await settle(page, 400);
}

// ---- stills --------------------------------------------------------------

const SHOTS = {
  async day(page) {
    await reset(page);
  },

  async overdue(page) {
    await clickOn(page, nav(page, /^Overdue/), { before: 0 });
  },

  async upcoming(page) {
    await clickOn(page, nav(page, 'Upcoming'), { before: 0 });
  },

  async todos(page) {
    await clickOn(page, nav(page, /^To-dos/), { before: 0 });
  },

  async calendar(page) {
    await clickOn(page, nav(page, 'Calendar'), { before: 0 });
  },

  async clients(page) {
    await clickOn(page, nav(page, 'Clients'), { before: 0 });
  },

  async insights(page) {
    await clickOn(page, nav(page, 'Insights'), { before: 0 });
    // Recharts animates its bars in on mount and the chunk is fetched on the way
    // into the tab, so this one needs longer than the rest.
    await settle(page, 2200);
  },

  async archive(page) {
    await clickOn(page, nav(page, 'Archive'), { before: 0 });
  },

  async shortcuts(page) {
    await clickOn(page, nav(page, 'Shortcuts'), { before: 0 });
  },

  /** The task everything else in the demo refers back to: description, prompts,
   *  notes, links, tags, a subtask and the status rail, all on one screen.
   *
   *  Opened by its route rather than by clicking the row it sits on. Clicking is
   *  what a person does, but the row also carries an expander and a rail of
   *  actions that appear under the pointer, and which of them a click lands on
   *  depends on where the row happens to be — a shot that has to be right every
   *  run should not be decided by four pixels. */
  async task(page) {
    await reset(page);
    await page.goto(`${BASE_URL}/app/task/t_ac0001`, { waitUntil: 'domcontentloaded' });
    await newTaskButton(page).waitFor({ state: 'visible', timeout: 60_000 });
    await settle(page, 1000);
  },

  async search(page) {
    await reset(page);
    await page.keyboard.press('Meta+f');
    await settle(page, 500);
    await page.keyboard.type('export', { delay: 70 });
    await settle(page, 700);
  },

  async settings(page) {
    await reset(page);
    await clickOn(page, nav(page, 'Settings'), { before: 0 });
    await settle(page, 600);
  },

  /** The status list, which is the screen behind "the list is yours". */
  async statuses(page) {
    await clickOn(page, nav(page, 'Settings'), { before: 0 });
    await settle(page, 400);
    const heading = page.getByText('Task statuses', { exact: true }).first();
    await heading.scrollIntoViewIfNeeded();
    await settle(page, 500);
  },
};

/** The one shot taken at a phone's size rather than the shared viewport. */
async function mobileShot(browser) {
  const context = browser.contexts()[0];
  const page = await context.newPage();
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto(`${process.env.WORKLOG_URL ?? 'http://localhost:4321'}/app`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /New task/ }).first().waitFor({ state: 'visible', timeout: 60_000 });
  await settle(page, 1200);
  await page.screenshot({ path: join(SHOTS_DIR, 'mobile.png') });
  await page.close();
  console.log('  mobile.png');
}

// ---- recorded beats ------------------------------------------------------

// Each beat is `{ prepare, run }`. Only `run` is recorded — getting back to the
// Day view and scrolling to the right place is how the shot is set up, not part
// of what it shows, and a clip that opens on two seconds of the page settling is
// two seconds the cut has to throw away.
const CLIPS = {
  /** The loop the app exists for: the unlogged stretch of the day, filled.
   *
   *  The form is not filled in here beyond the note. Clicking the gap opens it
   *  already set to the hours that were missing, which is the point of the shot —
   *  typing that number in would be staging something the app does for you. */
  logTime: {
    async prepare(page) {
      await reset(page);
      // The log form opens *under* the day card, so the card has to come up the
      // page or the form is half below the bottom edge. Backed off again
      // afterwards by more than the sticky day header is tall: flush to the top,
      // the card's own top border sits behind that header, and a card with no
      // visible top edge reads as a rendering fault rather than as a scroll.
      await page.getByText('YOUR DAY').first().evaluate((el) => {
        el.scrollIntoView({ block: 'start' });
        // Whatever actually moved — the main column has its own scroller, not the
        // document — backed off by more than the sticky day header is tall.
        for (let n = el; n; n = n.parentElement) {
          if (n.scrollTop > 0) {
            n.scrollTop = Math.max(0, n.scrollTop - 120);
            return;
          }
        }
        document.scrollingElement?.scrollBy(0, -120);
      });
      await settle(page, 700);
    },
    async run(page) {
      await clickOn(page, page.getByText('click to fill').first(), { after: 1600 });
      await typeInto(page, page.getByPlaceholder('what you worked on'), 'Onboarding motion review');
      await pause(page, 1000);
      await clickOn(page, page.getByRole('button', { name: 'Log', exact: true }).first(), { after: 2800 });
    },
  },

  /** A task written down: title, client, priority, saved. */
  newTask: {
    prepare: reset,
    async run(page) {
      // Tighter beats than the other clips. This one has five steps in it, and
      // at the pace the others are driven at it runs to eleven seconds — a fifth
      // of the tour for one form. Shortening the pauses is the honest way to get
      // it down; playing it back faster than it was performed is not.
      await clickOn(page, newTaskButton(page), { after: 700 });
      await typeInto(page, page.getByPlaceholder('Add a title for this task'), 'Send the August invoices', { delay: 45 });
      await pause(page, 450);
      await clickOn(page, page.getByRole('button', { name: 'Acme Corp', exact: true }).first(), { before: 220, after: 420 });
      await clickOn(page, page.getByRole('button', { name: /^Priority: / }).first(), { before: 220, after: 400 });
      // The rows in these pickers are buttons with an explicit `menuitemradio`
      // role, so `getByRole('button')` does not see them.
      await clickOn(page, page.getByRole('menuitemradio', { name: 'High', exact: true }), { before: 220, after: 620 });
      await clickOn(page, page.getByRole('button', { name: 'Add task', exact: true }).first(), { before: 260, after: 1900 });
    },
  },

  /** Where a task goes when it is done, which is the archive rather than
   *  nowhere. The status list in the picker is the demo repo's own — Waiting for
   *  and In review are in it because ../demo put them there. */
  closeTask: {
    prepare: reset,
    async run(page) {
      await clickOn(page, page.getByRole('button', { name: /^Status: / }).first(), { after: 900 });
      await clickOn(page, page.getByRole('menuitemradio', { name: /^Closed/ }), { after: 2800 });
    },
  },

  /** The half nothing else does: the edit becoming a commit on the branch.
   *
   *  It makes one first — marking an overdue task as worked on — so there is
   *  something pending to watch go. ../demo leaves `autoSync.events` empty and
   *  the delay at a minute, so the edit sits unsent for the length of a clip
   *  instead of being committed out from under the shot. */
  sync: {
    prepare: reset,
    async run(page) {
      await clickOn(page, page.getByRole('button', { name: /^Log work today/ }).first(), { after: 1600 });
      await clickOn(page, nav(page, 'Git sync'), { after: 3600 });
    },
  },
};

// ---- the screencast ------------------------------------------------------

/** Record `run` and write it out as constant-rate h264.
 *
 *  CDP emits a frame when the page paints and not otherwise, so what comes back
 *  is a variable-rate stream with a timestamp on each frame. Resampling it onto
 *  a fixed 30 fps grid here — rather than handing ffmpeg the timestamps — is
 *  what makes a frame number in the Remotion timeline mean a fixed number of
 *  milliseconds, which is the whole basis of the cut. */
async function record(page, name, clip) {
  await clip.prepare?.(page);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    frames.push({ t: metadata.timestamp, data });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  await showPointer(page);
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    // Generous rather than exact: these are a ceiling, and the frames arrive at
    // the surface's own 2560x1640 because of the browser flag in harness.mjs.
    maxWidth: 4096,
    maxHeight: 4096,
    everyNthFrame: 1,
  });
  await clip.run(page);
  await pause(page, 500);
  await cdp.send('Page.stopScreencast');
  await cdp.detach().catch(() => {});

  if (frames.length < 2) {
    throw new Error(`${name}: the page painted ${frames.length} times — nothing to cut`);
  }

  const src = join(TMP, name, 'src');
  const seq = join(TMP, name, 'seq');
  rmSync(join(TMP, name), { recursive: true, force: true });
  mkdirSync(src, { recursive: true });
  mkdirSync(seq, { recursive: true });

  frames.sort((a, b) => a.t - b.t);
  const paths = frames.map((frame, i) => {
    const path = join(src, `${String(i).padStart(5, '0')}.jpg`);
    writeFileSync(path, Buffer.from(frame.data, 'base64'));
    return path;
  });

  const t0 = frames[0].t;
  const seconds = frames[frames.length - 1].t - t0;
  const count = Math.max(2, Math.round(seconds * CLIP_FPS));
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const at = t0 + i / CLIP_FPS;
    while (cursor + 1 < frames.length && frames[cursor + 1].t <= at) {
      cursor++;
    }
    // Hard links rather than copies: a ten-second beat is a few hundred frames
    // of which only the painted ones are distinct.
    linkSync(paths[cursor], join(seq, `${String(i).padStart(5, '0')}.jpg`));
  }

  mkdirSync(CLIPS_DIR, { recursive: true });
  const out = join(CLIPS_DIR, `${name}.mp4`);
  execFileSync(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', String(CLIP_FPS),
      '-i', join(seq, '%05d.jpg'),
      // Even dimensions, because h264 chroma subsampling has no answer for odd
      // ones and the capture is whatever size the compositor handed back.
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264', '-crf', '15', '-preset', 'slow',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  rmSync(join(TMP, name), { recursive: true, force: true });

  console.log(`  ${name}.mp4 — ${count} frames, ${(count / CLIP_FPS).toFixed(1)}s (${frames.length} painted)`);
  return { frames: count, fps: CLIP_FPS };
}

// ---- run -----------------------------------------------------------------

const argv = process.argv.slice(2);
const wants = (kind, name) => {
  if (argv.length === 0) return true;
  if (argv.includes(kind)) return true;
  return argv.includes(name);
};

mkdirSync(SHOTS_DIR, { recursive: true });
const { browser, page } = await openApp({ pointer: true });

const shotNames = Object.keys(SHOTS).filter((n) => wants('shots', n));
if (shotNames.length) {
  console.log('shots');
  for (const name of shotNames) {
    await showPointer(page);
    await SHOTS[name](page);
    // A still is taken with nothing under the pointer. Hiding the dot is not
    // enough: the row it was left on keeps its hover state, which on a task row
    // swaps the title for a rail of action buttons.
    await park(page);
    await hidePointer(page);
    await settle(page, 400);
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`) });
    console.log(`  ${name}.png`);
  }
  if (wants('shots', 'mobile')) {
    await mobileShot(browser);
  }
}

const clipNames = Object.keys(CLIPS).filter((n) => wants('clips', n));
if (clipNames.length) {
  console.log('clips');
  mkdirSync(TMP, { recursive: true });
  const manifestPath = join(PUBLIC, 'clips.json');
  // Merged rather than replaced, so re-recording one beat by name leaves the
  // lengths of the others alone.
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  for (const name of clipNames) {
    manifest[name] = await record(page, name, CLIPS[name]);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  rmSync(TMP, { recursive: true, force: true });
}

await browser.close();

if (existsSync(SHOTS_DIR)) {
  console.log(`\n${readdirSync(SHOTS_DIR).length} stills in public/shots`);
}
