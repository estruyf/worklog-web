// CHANGELOG.md is published: src/pages/changelog.astro hands it to Astro's Markdown
// pipeline and renders the result verbatim. That makes the file's shape load-bearing
// in ways a changelog normally isn't — the page's layout keys off `## YYYY-MM-DD`
// headings, and a link that resolves against `/changelog` is a 404 in front of
// readers. Neither shows up in `npm run build`, so it gets a test.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../CHANGELOG.md', import.meta.url)), 'utf8');
const lines = source.split('\n');

/** The `## …` headings, in file order. */
const dayHeadings = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());

/** Markdown link targets outside HTML comments — `[text](target)`. */
const linkTargets = [...source.replace(/<!--[\s\S]*?-->/g, '').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);

describe('CHANGELOG.md', () => {
  it('is a run of day headings', () => {
    expect(dayHeadings.length).toBeGreaterThan(0);
  });

  it('dates every heading as YYYY-MM-DD', () => {
    for (const heading of dayHeadings) {
      expect(heading, heading).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Catches 2026-13-01 and 2026-02-30, which the pattern alone lets through.
      const [y, m, d] = heading.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      expect(
        [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()],
        `${heading} is not a real date`
      ).toEqual([y, m, d]);
    }
  });

  it('keeps the newest day on top, one heading per day', () => {
    const sorted = [...dayHeadings].sort().reverse();
    // String order is date order for YYYY-MM-DD, so this doubles as the duplicate
    // check: two headings for one day would leave the page with two "Latest"-ish
    // blocks for the same date and no way to tell which came first.
    expect(dayHeadings).toEqual(sorted);
    expect(new Set(dayHeadings).size).toBe(dayHeadings.length);
  });

  it('gives every day at least one entry', () => {
    let seen: string | null = null;
    const entries = new Map<string, number>();
    for (const line of lines) {
      if (line.startsWith('## ')) {
        seen = line.slice(3).trim();
        entries.set(seen, 0);
      } else if (seen && line.startsWith('- ')) {
        entries.set(seen, (entries.get(seen) ?? 0) + 1);
      }
    }
    for (const [day, count] of entries) {
      expect(count, `${day} has no entries`).toBeGreaterThan(0);
    }
  });

  it('links absolutely, since a relative path resolves against /changelog', () => {
    for (const target of linkTargets) {
      expect(target, `${target} would 404 under /changelog`).toMatch(/^(https?:\/\/|mailto:|\/|#)/);
    }
  });
});
