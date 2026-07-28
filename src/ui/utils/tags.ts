// Tag entry helpers, kept pure so the picker's rules are unit-testable.
//
// The point of these is that a tag list stays a small, deliberate vocabulary:
// typing a tag that already exists in another casing or with stray spacing
// reuses the existing spelling instead of forking a near-duplicate, and only a
// genuinely unseen tag is offered as something to create.

/** The stored shape of a tag: trimmed, with inner whitespace collapsed. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** The existing tag `raw` should fold onto, comparing case-insensitively. */
export function matchExistingTag(raw: string, known: string[]): string | undefined {
  const needle = normalizeTag(raw).toLowerCase();
  return needle ? known.find((k) => k.toLowerCase() === needle) : undefined;
}

/** Append a typed tag, folded onto an existing spelling when there is one.
 *  Returns the list unchanged when the tag is blank or already on it. */
export function addTag(tags: string[], raw: string, known: string[]): string[] {
  const tag = matchExistingTag(raw, known) ?? normalizeTag(raw);
  if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    return tags;
  }
  return [...tags, tag];
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}

/** Existing tags to offer for `query`: unselected ones only, prefix matches
 *  first. `known` arrives usage-ranked and that order holds within each bucket,
 *  so the most-used tags lead when the query is empty. */
export function suggestTags(query: string, known: string[], selected: string[], limit = 8): string[] {
  const q = normalizeTag(query).toLowerCase();
  const taken = new Set(selected.map((t) => t.toLowerCase()));
  const pool = known.filter((k) => !taken.has(k.toLowerCase()));
  if (!q) {
    return pool.slice(0, limit);
  }
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const k of pool) {
    const lower = k.toLowerCase();
    if (lower.startsWith(q)) {
      prefix.push(k);
    } else if (lower.includes(q)) {
      contains.push(k);
    }
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** True when `query` would introduce a tag that doesn't exist yet — the only
 *  case where creating one should be offered, so a typo takes a deliberate act. */
export function isNewTag(query: string, known: string[], selected: string[]): boolean {
  const tag = normalizeTag(query).toLowerCase();
  if (!tag) {
    return false;
  }
  return !known.some((k) => k.toLowerCase() === tag) && !selected.some((t) => t.toLowerCase() === tag);
}
