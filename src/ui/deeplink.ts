// Inbound task deeplinks: /app/new?title=…&url=… — how something outside the app
// (a browser extension, a bookmarklet, a shortcut) hands Worklog a task to create.
// A deeplink only *fills the form*; nothing here writes, so an opened link can
// never commit to the repo on its own and no new auth surface comes with it.
//
// Query params rather than history state, because an external caller has no way to
// push state. The router normalizes them into the ordinary `TaskFormSeed` on
// arrival and strips them from the URL (see `consumeTaskDeeplink`), so this stays
// an entry format — the rest of the app keeps seeing exactly one seeding
// mechanism, and the params can't ride along on the query string `navigate`
// preserves into every later route.
//
// Everything here is untrusted: the values come from whoever opened the link. They
// end up in Markdown that has to keep round-tripping, so each field is flattened
// and capped to what its serialized form allows — a title is one `## ` line, a
// link is `- link: <url> <label>`, tags are comma-separated on one line
// (`parser/taskParser.ts`). A url additionally has to survive being an href, so
// only http(s)/mailto get through.

import type { TaskFormSeed } from './router';

/** The params a deeplink may carry. The router deletes exactly these once read,
 *  so unrelated query (owner/repo/branch, which selects the mounted repo) rides
 *  on untouched. */
export const DEEPLINK_PARAMS = ['title', 'url', 'label', 'client', 'parent', 'due', 'tags', 'description'] as const;

// Bounds, not validation: a hostile or sloppy caller shouldn't be able to paste a
// megabyte into a file that gets committed. Everything is editable in the form.
const MAX_TITLE = 300;
const MAX_LABEL = 120;
const MAX_TAG = 60;
const MAX_TAGS = 20;
const MAX_LINKS = 10;
const MAX_DESCRIPTION = 5000;

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// `\p{Cc}` is the control range. Written as a property escape rather than a
// literal range so the characters this guards against can't end up *in* the guard.
const CONTROL = /\p{Cc}+/gu;
const CONTROL_KEEPING_BREAKS = /(?:(?!\n|\t)\p{Cc})+/gu;

/** One line of plain text. Control characters go first — a newline in a title
 *  would serialize as a second Markdown line and split the task in two, and one in
 *  a link label would orphan everything after it. */
function line(value: string | null | undefined, max: number): string {
  if (!value) {
    return '';
  }
  return value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Multi-line text: newlines and tabs survive (the description is Markdown), the
 *  rest of the control range doesn't. */
function block(value: string | null | undefined, max: number): string {
  if (!value) {
    return '';
  }
  return value.replace(/\r\n?/g, '\n').replace(CONTROL_KEEPING_BREAKS, ' ').trim().slice(0, max);
}

/** A url safe to put behind an href and into `- link: <url> <label>`, or null.
 *  Normalizing through `URL` is what percent-encodes the spaces that would
 *  otherwise read as the start of the label. */
function safeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Read a deeplink's params into a form seed.
 *
 *  Returns null when the URL carries no deeplink params at all — that's a plain
 *  visit to /app/new and nothing should be touched. An *empty* seed is a different
 *  answer: params were there but nothing survived sanitizing, and the router still
 *  has to strip them. */
export function parseTaskDeeplink(params: URLSearchParams): TaskFormSeed | null {
  if (!DEEPLINK_PARAMS.some((key) => params.has(key))) {
    return null;
  }

  const seed: TaskFormSeed = {};

  const title = line(params.get('title'), MAX_TITLE);
  if (title) {
    seed.title = title;
  }

  // Labels pair with urls by position, and the pairing is fixed *before* the
  // rejected urls drop out — otherwise one bad url would shift every label after
  // it onto the wrong link.
  const labels = params.getAll('label');
  const links = params
    .getAll('url')
    .slice(0, MAX_LINKS)
    .map((raw, i) => ({ url: safeUrl(raw), label: line(labels[i], MAX_LABEL) }))
    .filter((l): l is { url: string; label: string } => l.url !== null)
    .map((l) => (l.label ? { url: l.url, label: l.label } : { url: l.url }));
  if (links.length) {
    seed.links = links;
  }

  const client = line(params.get('client'), MAX_LABEL);
  if (client) {
    seed.clientId = client;
  }

  const parent = line(params.get('parent'), MAX_LABEL);
  if (parent) {
    seed.parentId = parent;
  }

  // A due date that isn't a date is dropped rather than typed into the field: dates
  // are YYYY-MM-DD everywhere (see util/date), and the form has nowhere to report
  // "that isn't one".
  const due = line(params.get('due'), 10);
  if (DATE.test(due)) {
    seed.due = due;
  }

  // Comma-separated, and repeatable, so `?tags=a,b` and `?tags=a&tags=b` both work.
  const tags = [
    ...new Set(
      params
        .getAll('tags')
        .join(',')
        .split(',')
        .map((tag) => line(tag, MAX_TAG))
        .filter(Boolean),
    ),
  ].slice(0, MAX_TAGS);
  if (tags.length) {
    seed.tags = tags;
  }

  const description = block(params.get('description'), MAX_DESCRIPTION);
  if (description) {
    seed.description = description;
  }

  return seed;
}
