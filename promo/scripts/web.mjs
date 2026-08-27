// Re-encodes the two renders for the web and drops them, with a poster, into the
// app's own public/video/.
//
//   npm run web
//
// The renders in out/ are the masters — CRF 17, ~7 MB and ~23 MB — and they are
// what to upload anywhere that re-encodes for you. These are the copies the
// landing page serves, so they are sized for a first visit rather than for an
// archive: no audio track at all (both cuts are silent by design), `faststart`
// so the browser can begin on the first packet instead of waiting for the index,
// and the tour dropped to 720p because it plays into a box that is never wider
// than half the page.

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../out');
const VIDEO = resolve(HERE, '../../public/video');

mkdirSync(VIDEO, { recursive: true });

const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const mb = (path) => `${(statSync(path).size / 1024 / 1024).toFixed(1)} MB`;

const encode = (from, to, scale) => {
  ffmpeg([
    '-i', join(OUT, from),
    ...(scale ? ['-vf', `scale=${scale}:flags=lanczos`] : []),
    '-c:v', 'libx264', '-crf', '25', '-preset', 'slow',
    '-profile:v', 'high', '-level', '4.0',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-an',
    join(VIDEO, to),
  ]);
  console.log(`public/video/${to} — ${mb(join(VIDEO, to))}`);
};

encode('worklog-promo.mp4', 'worklog-promo.mp4', null);
encode('worklog-tour.mp4', 'worklog-tour.mp4', '1280:720');

// The poster is the frame the promo holds on longest with the app fully on
// screen — the day view under its own caption. A poster of the title card would
// be a picture of a logo, which is what the page above it already is.
ffmpeg([
  '-i', join(OUT, 'worklog-promo.mp4'),
  '-vf', "select='eq(n\\,150)'", '-frames:v', '1',
  '-q:v', '4',
  join(VIDEO, 'worklog-poster.jpg'),
]);
console.log(`public/video/worklog-poster.jpg — ${mb(join(VIDEO, 'worklog-poster.jpg'))}`);
