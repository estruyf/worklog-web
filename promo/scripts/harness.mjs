// Opens the real Worklog app in a browser, against the demo timesheet in
// ../demo, and hands back a page the shot list can drive. Nothing here reaches
// GitHub: `/api/*` is answered from disk, which is the whole reason the video
// can be re-cut from a clean checkout with no account and no network.
//
// Called only by capture.mjs.

import { chromium } from 'playwright';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEMO_DIR = resolve(HERE, '../demo');

export const BASE_URL = process.env.WORKLOG_URL ?? 'http://localhost:4321';

/// The app is captured at this size and mounted in a 1920x1080 frame below the
/// pixels it was taken at, so nothing is ever enlarged. It is narrower than a
/// real laptop on purpose: the dashboard lays out three columns either way, and
/// a narrower window makes the app's own 14px text a larger share of the frame.
export const VIEWPORT = { width: 1280, height: 820 };
export const DPR = 2;

/// Every date in ../demo is written against this day, and the clock is pinned to
/// it, so "Thu 27 Aug 2026" and the overdue counts are the same on every re-run.
/// Re-anchoring the video means moving the dates in ../demo and this line
/// together.
export const DEMO_NOW = new Date('2026-08-27T10:24:00');

const REPO = { owner: 'you', repo: 'timesheet', branch: 'main' };

/** The demo timesheet as the `/api/load` payload the client expects. */
function demoFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (!entry.startsWith('.DS_Store')) {
        files.push(path);
      }
    }
  };
  walk(DEMO_DIR);

  const text = {};
  const sha = {};
  for (const path of files) {
    const rel = relative(DEMO_DIR, path);
    text[rel] = readFileSync(path, 'utf8');
    // Content-addressing would be truer, but nothing in the app compares these
    // to anything it computes — they only have to be stable and distinct.
    sha[rel] = `demo${rel.replace(/\W/g, '')}`;
  }
  return { text, sha };
}

/** Draws the pointer the screencast leaves out.
 *
 *  CDP's `Page.startScreencast` composites the page and not the cursor, so a
 *  recording of a click is a recording of something happening for no visible
 *  reason. This puts a dot back at the position the browser is actually
 *  reporting — it follows real mouse events rather than a scripted path, so it
 *  cannot drift away from where the click lands. */
const POINTER = () => {
  const dot = document.createElement('div');
  dot.id = '__promo_pointer';
  dot.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'left:0', 'top:0',
    'width:22px', 'height:22px', 'margin:-11px 0 0 -11px',
    'border-radius:50%', 'pointer-events:none', 'opacity:0',
    'background:rgba(31,35,40,0.55)', 'border:2px solid #fff',
    'box-shadow:0 2px 10px rgba(0,0,0,0.35)',
    'transition:opacity .2s, transform .12s',
  ].join(';');
  const ring = document.createElement('div');
  ring.id = '__promo_ring';
  ring.style.cssText = [
    'position:fixed', 'z-index:2147483646', 'left:0', 'top:0',
    'width:22px', 'height:22px', 'margin:-11px 0 0 -11px',
    'border-radius:50%', 'pointer-events:none', 'opacity:0',
    'border:3px solid #E2BE2E',
  ].join(';');
  const attach = () => {
    document.body.append(dot, ring);
  };
  if (document.body) {
    attach();
  } else {
    document.addEventListener('DOMContentLoaded', attach);
  }

  let x = 0;
  let y = 0;
  addEventListener(
    'mousemove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.opacity = '1';
      dot.style.transform = `translate(${x}px, ${y}px)`;
      ring.style.transform = `translate(${x}px, ${y}px)`;
    },
    true,
  );
  addEventListener(
    'mousedown',
    () => {
      dot.style.transform = `translate(${x}px, ${y}px) scale(0.75)`;
      ring.style.transition = 'none';
      ring.style.opacity = '0.9';
      ring.style.transform = `translate(${x}px, ${y}px) scale(1)`;
      requestAnimationFrame(() => {
        ring.style.transition = 'opacity .45s ease-out, transform .45s ease-out';
        ring.style.opacity = '0';
        ring.style.transform = `translate(${x}px, ${y}px) scale(2.6)`;
      });
    },
    true,
  );
  addEventListener(
    'mouseup',
    () => {
      dot.style.transform = `translate(${x}px, ${y}px) scale(1)`;
    },
    true,
  );
};

/** Hide the pointer for the still shots — a dot parked in the middle of a
 *  screenshot is not something anyone would frame on purpose. */
export async function hidePointer(page) {
  await page.evaluate(() => {
    for (const id of ['__promo_pointer', '__promo_ring']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });
}

export async function showPointer(page) {
  await page.evaluate(() => {
    for (const id of ['__promo_pointer', '__promo_ring']) {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    }
  });
}

/** Launch a browser and open /app on the demo timesheet, ready to drive. */
export async function openApp({ headless = true, pointer = false } = {}) {
  const { text, sha } = demoFiles();
  const browser = await chromium.launch({
    headless,
    args: [
      // `Page.startScreencast` composites at *CSS* resolution and ignores the
      // context's deviceScaleFactor, so without this every recorded beat comes
      // back at 1280x820 and has to be upscaled to sit beside the 2x stills.
      // Forcing the scale factor on the browser itself moves the whole surface
      // to 2x while the CSS viewport stays 1280x820 — which matters, because the
      // sidebar's lower half is positioned in `vh` and any trick that inflates
      // the viewport instead (`zoom` on the root, a 2560px window) pushes it off
      // the bottom of every shot.
      '--force-device-scale-factor=2',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
    ],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'Europe/Brussels',
    reducedMotion: 'no-preference',
  });

  // Frozen, not faked: `Date.now()` returns the anchor day while every timer
  // still runs, so the debounced committer and the app's own animations behave
  // exactly as they do in use.
  await context.clock.setFixedTime(DEMO_NOW);

  // The gate on /app only checks that a session cookie exists; the API routes
  // that would verify it are all answered below.
  await context.addCookies([{ name: 'wl_gh_token', value: 'demo', domain: 'localhost', path: '/' }]);

  await context.addInitScript(
    ([repo]) => {
      localStorage.setItem('worklog:lastRepo', JSON.stringify(repo));
      // A service worker outlives the run and would serve the previous capture's
      // bundle back on the next one.
      Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined });
    },
    [REPO],
  );
  if (pointer) {
    await context.addInitScript(POINTER);
  }

  const json = (r, body) => r.fulfill({ json: body });
  await context.route('**/api/user', (r) =>
    json(r, { authenticated: true, user: { login: REPO.owner, name: 'You', avatarUrl: '' } }),
  );
  await context.route('**/api/repos', (r) =>
    json(r, {
      repos: [
        { fullName: `${REPO.owner}/${REPO.repo}`, owner: REPO.owner, name: REPO.repo, private: true, defaultBranch: 'main', pushedAt: null },
      ],
    }),
  );
  await context.route('**/api/head*', (r) => json(r, { branch: REPO.branch, commitSha: 'demo0000' }));
  await context.route('**/api/load*', (r) =>
    json(r, { ...REPO, baseCommitSha: 'demo0000', text, sha }),
  );
  // A commit that always succeeds, after a beat: the sync shot is about the
  // status going from pending to written, and it needs long enough to read.
  await context.route('**/api/commit', async (r) => {
    await new Promise((done) => setTimeout(done, 900));
    await json(r, { commitSha: 'demo0001', branch: REPO.branch });
  });
  await context.route('**/sw.js', (r) => r.fulfill({ status: 404, body: '' }));
  // Nothing in a capture should reach the network. The visitor pixel is the only
  // thing that tries.
  await context.route('**://api.visitorbadge.io/**', (r) => r.abort());

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
  // `astro preview`, not `astro dev`: the production build has no dev toolbar
  // sitting over the bottom of every shot, and its CSP refuses the stylesheet
  // that would hide one — which is the policy working, not a problem to solve.
  // Playwright's init scripts are injected through CDP and are not subject to it.
  // The wordmark is not the signal to wait on: the mobile drawer renders a
  // second, hidden copy of it, and a text match finds that one first. The New
  // task button exists once and only after the store has opened the repo.
  await page.getByRole('button', { name: /New task/ }).first().waitFor({ state: 'visible', timeout: 60_000 });
  await settle(page);

  return { browser, context, page };
}

/** Wait for the app to stop moving. Every shot ends with one of these rather
 *  than a fixed sleep, so a slower machine does not capture a half-drawn view. */
export async function settle(page, ms = 500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(ms);
}
