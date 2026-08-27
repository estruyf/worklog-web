// Copies the two things the videos need from outside this folder: the app icon,
// and the one demo file the Markdown scene puts on screen.
//
//   node scripts/assets.mjs
//
// The Markdown is copied rather than retyped into a string. That scene's whole
// claim is that what the app was rendering and what the repo holds are the same
// text — a second copy that drifted would make it a lie the moment either side
// was edited.

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '../public');
const REPO = resolve(HERE, '../..');

mkdirSync(PUBLIC, { recursive: true });

copyFileSync(join(REPO, 'public/worklog-512x512.png'), join(PUBLIC, 'icon.png'));
copyFileSync(resolve(HERE, '../demo/clients/acme.md'), join(PUBLIC, 'acme.md'));

console.log('public/icon.png');
console.log('public/acme.md');
