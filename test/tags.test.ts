// Unit tests for the tag picker's rules. The point of these is the anti-typo
// behaviour: a tag typed in a different case or with stray spacing must fold
// onto the tag that already exists rather than forking a near-duplicate.

import { describe, it, expect } from 'vitest';
import { addTag, isNewTag, matchExistingTag, normalizeTag, removeTag, suggestTags } from '../src/ui/utils/tags';

// Usage-ranked, the way the model hands them over.
const KNOWN = ['mobile', 'bug', 'frontend', 'urgent', 'design system'];

describe('normalizeTag', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeTag('  bug ')).toBe('bug');
    expect(normalizeTag('design   system')).toBe('design system');
    expect(normalizeTag('   ')).toBe('');
  });
});

describe('matchExistingTag', () => {
  it('finds the existing spelling regardless of case or padding', () => {
    expect(matchExistingTag('Mobile', KNOWN)).toBe('mobile');
    expect(matchExistingTag('  BUG  ', KNOWN)).toBe('bug');
    expect(matchExistingTag('design   system', KNOWN)).toBe('design system');
  });

  it('is undefined for an unknown or empty tag', () => {
    expect(matchExistingTag('backend', KNOWN)).toBeUndefined();
    expect(matchExistingTag('  ', KNOWN)).toBeUndefined();
  });
});

describe('addTag', () => {
  it('folds a re-spelling onto the tag that already exists', () => {
    expect(addTag([], 'Mobile', KNOWN)).toEqual(['mobile']);
    expect(addTag([], ' BUG ', KNOWN)).toEqual(['bug']);
  });

  it('keeps a genuinely new tag as typed, normalized', () => {
    expect(addTag([], '  Backend API ', KNOWN)).toEqual(['Backend API']);
  });

  it('refuses blanks and duplicates, including case-different ones', () => {
    const tags = ['mobile'];
    expect(addTag(tags, '   ', KNOWN)).toBe(tags);
    expect(addTag(tags, 'mobile', KNOWN)).toBe(tags);
    expect(addTag(tags, 'MOBILE', KNOWN)).toBe(tags);
  });

  it('appends without mutating the original list', () => {
    const tags = ['mobile'];
    expect(addTag(tags, 'bug', KNOWN)).toEqual(['mobile', 'bug']);
    expect(tags).toEqual(['mobile']);
  });
});

describe('removeTag', () => {
  it('drops just that tag', () => {
    expect(removeTag(['mobile', 'bug'], 'mobile')).toEqual(['bug']);
  });
});

describe('suggestTags', () => {
  it('offers the most-used tags first when nothing is typed', () => {
    expect(suggestTags('', KNOWN, [], 3)).toEqual(['mobile', 'bug', 'frontend']);
  });

  it('never offers what is already selected', () => {
    expect(suggestTags('', KNOWN, ['mobile', 'BUG'], 3)).toEqual(['frontend', 'urgent', 'design system']);
  });

  it('ranks prefix matches above substring matches', () => {
    // "design system" contains "s"; "system"-prefixed tags would come first.
    expect(suggestTags('u', KNOWN, [])).toEqual(['urgent', 'bug']);
  });

  it('matches case-insensitively and honours the limit', () => {
    expect(suggestTags('MOB', KNOWN, [])).toEqual(['mobile']);
    expect(suggestTags('', KNOWN, [], 2)).toHaveLength(2);
  });
});

describe('isNewTag', () => {
  it('is false when an existing tag covers the query in any casing', () => {
    expect(isNewTag('mobile', KNOWN, [])).toBe(false);
    expect(isNewTag('Mobile', KNOWN, [])).toBe(false);
    expect(isNewTag('  bug ', KNOWN, [])).toBe(false);
  });

  it('is false for a blank query or one already selected', () => {
    expect(isNewTag('   ', KNOWN, [])).toBe(false);
    expect(isNewTag('Backend', KNOWN, ['backend'])).toBe(false);
  });

  it('is true only for something genuinely unseen', () => {
    expect(isNewTag('backend', KNOWN, [])).toBe(true);
  });
});
