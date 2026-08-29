// Reusable checklists: what the parser reads out of `lists/<id>.md`, what the
// service writes back, and how two devices ticking the same list merge.
//
// The property under test throughout is that an edit is a *line* edit. A list is
// a file people write in by hand — prose under an item, a nested bullet, a link
// to the runbook — and the app has to tick a box without disturbing any of it.
// The whole stack is in-memory, so these run the real indexer → db → service path.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/store';
import { FileMap, mountFileMap } from '../src/workspace/paths';
import { parseChecklistFile, splitChecklistItems } from '../src/parser/checklistParser';
import {
  addChecklistItemTo,
  addChecklistSectionTo,
  createChecklist,
  deleteChecklistSection,
  deleteChecklist,
  deleteChecklistItem,
  duplicateChecklist,
  moveChecklistItemTo,
  moveChecklistSectionBy,
  renameChecklistById,
  renameChecklistItem,
  renameChecklistSectionAt,
  setChecklistItem,
  startChecklistAgain,
} from '../src/services/checklists';
import { checklistItems, checklistProgress, uniqueChecklistId } from '../src/model/checklist';
import { mergeFile } from '../src/data/merge';
import { isWorklogPath } from '../src/server/github';

const CONFIG = {
  hoursPerDay: 8,
  clients: [{ id: 'acme', name: 'Acme Corp' }],
};

// Deliberately awkward: two sections, a paragraph the app never wrote, a nested
// bullet under an item, and a `*` bullet instead of a `-`.
const RELEASE_MD = `# Release checklist
- last run: 2026-08-12

Run this from a clean checkout. See [the runbook](https://example.com/runbook).

## Steps
- [ ] Bump the version
- [x] Update the changelog
  - the entry goes under today's date
* [ ] Tag it

## After
- [ ] Announce it
`;

const PACKING_MD = `# Cycling trip

- [ ] Multi-tool
- [ ] Spare tubes
`;

let store: Store;
let fm: FileMap;

async function mount(files: Record<string, string> = {}) {
  fm = new FileMap();
  fm.text.set('.worklog/config.json', JSON.stringify(CONFIG, null, 2));
  fm.text.set('lists/release.md', RELEASE_MD);
  fm.text.set('lists/cycling-trip.md', PACKING_MD);
  for (const [path, text] of Object.entries(files)) {
    fm.text.set(path, text);
  }
  for (const path of fm.text.keys()) {
    fm.remote.add(path);
  }
  mountFileMap(fm);
  store = new Store();
  await store.rebuild('test');
}

function list(id: string) {
  const found = store.db.getAllChecklists().find((l) => l.id === id);
  if (!found) {
    throw new Error(`no list ${id}`);
  }
  return found;
}

function text(id: string): string {
  return fm.text.get(`lists/${id}.md`) ?? '';
}

beforeEach(() => mount());

describe('parsing a list file', () => {
  it('reads the name, the last run and the sections', () => {
    const l = list('release');
    expect(l.name).toBe('Release checklist');
    expect(l.lastRun).toBe('2026-08-12');
    expect(l.sections.map((s) => s.title)).toEqual(['Steps', 'After']);
    expect(l.sections[0].items.map((i) => i.text)).toEqual(['Bump the version', 'Update the changelog', 'Tag it']);
  });

  it('reads `*` bullets and ticked boxes, and counts the run', () => {
    const l = list('release');
    expect(checklistItems(l).map((i) => i.done)).toEqual([false, true, false, false]);
    expect(checklistProgress(l)).toEqual({ done: 1, total: 4 });
  });

  it('keeps a list with no headings as one untitled section', () => {
    const l = list('cycling-trip');
    expect(l.sections).toHaveLength(1);
    expect(l.sections[0].title).toBeUndefined();
    expect(l.sections[0].items.map((i) => i.text)).toEqual(['Multi-tool', 'Spare tubes']);
  });

  it('falls back to the file name when the file has no title', () => {
    expect(parseChecklistFile('- [ ] something\n', 'lists/odd.md', 'odd').name).toBe('odd');
  });

  it('does not mistake a nested bullet for an item', () => {
    // The `- the entry goes under…` line is prose, not a box.
    expect(checklistItems(list('release'))).toHaveLength(4);
  });
});

describe('ticking an item', () => {
  it('rewrites one line and nothing else', async () => {
    const before = text('release');
    const item = list('release').sections[0].items[0];
    await setChecklistItem(store, 'release', item.line, true);

    const after = text('release');
    const changed = after.split('\n').filter((line, i) => line !== before.split('\n')[i]);
    expect(changed).toEqual(['- [x] Bump the version']);
    expect(checklistProgress(list('release'))).toEqual({ done: 2, total: 4 });
  });

  it('keeps the prose, the nested bullet and the `*` bullet untouched', async () => {
    const item = list('release').sections[1].items[0];
    await setChecklistItem(store, 'release', item.line, true);

    const after = text('release');
    expect(after).toContain('Run this from a clean checkout. See [the runbook](https://example.com/runbook).');
    expect(after).toContain("  - the entry goes under today's date");
    expect(after).toContain('* [ ] Tag it');
  });

  it('unticks again', async () => {
    const item = list('release').sections[0].items[1];
    await setChecklistItem(store, 'release', item.line, false);
    expect(text('release')).toContain('- [ ] Update the changelog');
  });
});

describe('editing items', () => {
  it('adds to the end of the section it was asked for', async () => {
    await addChecklistItemTo(store, 'release', 1, 'Post the release notes');
    const after = list('release');
    expect(after.sections[1].items.map((i) => i.text)).toEqual(['Announce it', 'Post the release notes']);
    // Still in the second section, not appended to the file.
    expect(after.sections[0].items).toHaveLength(3);
  });

  it('matches the bullet the section already uses', async () => {
    await mount({ 'lists/stars.md': '# Stars\n\n* [ ] one\n' });
    await addChecklistItemTo(store, 'stars', 0, 'two');
    expect(text('stars')).toBe('# Stars\n\n* [ ] one\n* [ ] two\n');
  });

  it('adds the first item of an empty list', async () => {
    const created = await createChecklist(store, 'Invoicing');
    expect(created?.id).toBe('invoicing');
    await addChecklistItemTo(store, 'invoicing', 0, 'Export the hours');
    expect(text('invoicing')).toBe('# Invoicing\n\n- [ ] Export the hours\n');
  });

  it('renames an item, keeping its tick', async () => {
    const item = list('release').sections[0].items[1];
    await renameChecklistItem(store, 'release', item.line, 'Write the changelog entry');
    expect(text('release')).toContain('- [x] Write the changelog entry');
  });

  it('flattens a pasted multi-line item to one line', async () => {
    const item = list('cycling-trip').sections[0].items[0];
    await renameChecklistItem(store, 'cycling-trip', item.line, '  Multi-tool\nand a chain breaker  ');
    expect(text('cycling-trip')).toContain('- [ ] Multi-tool and a chain breaker');
  });

  it('deletes one item and leaves the rest', async () => {
    const item = list('cycling-trip').sections[0].items[0];
    await deleteChecklistItem(store, 'cycling-trip', item.line);
    expect(text('cycling-trip')).toBe('# Cycling trip\n\n- [ ] Spare tubes\n');
  });

  it('ignores a blank item rather than writing an empty box', async () => {
    const before = text('cycling-trip');
    await addChecklistItemTo(store, 'cycling-trip', 0, '   ');
    expect(text('cycling-trip')).toBe(before);
  });
});

describe('the list itself', () => {
  it('creates a file from the name', async () => {
    const created = await createChecklist(store, 'Conference talk');
    expect(created?.name).toBe('Conference talk');
    expect(text('conference-talk')).toBe('# Conference talk\n');
  });

  it('never overwrites a list that already exists', async () => {
    await createChecklist(store, 'Cycling trip');
    expect(text('cycling-trip')).toBe(PACKING_MD);
    expect(text('cycling-trip-2')).toBe('# Cycling trip\n');
  });

  it('numbers ids from the ones already taken', () => {
    expect(uniqueChecklistId('Packing', [])).toBe('packing');
    expect(uniqueChecklistId('Packing', ['packing'])).toBe('packing-2');
    expect(uniqueChecklistId('Packing', ['packing', 'packing-2'])).toBe('packing-3');
    expect(uniqueChecklistId('!!!', [])).toBe('list');
  });

  it('renames the heading and leaves the file where it is', async () => {
    await renameChecklistById(store, 'cycling-trip', 'Bikepacking');
    expect(list('cycling-trip').name).toBe('Bikepacking');
    expect(text('cycling-trip')).toBe('# Bikepacking\n\n- [ ] Multi-tool\n- [ ] Spare tubes\n');
  });

  it('deletes the file, and commits the deletion because the branch has it', async () => {
    await deleteChecklist(store, 'cycling-trip');
    expect(store.db.getAllChecklists().map((l) => l.id)).toEqual(['release']);
    expect(fm.deleted.has('lists/cycling-trip.md')).toBe(true);
  });
});

// A list is either one run of items or a set of groups, and the app has to be
// able to turn the first into the second — not only read a file that already is.
describe('sections', () => {
  it('adds a group at the end of a flat list, leaving the items above it', async () => {
    await addChecklistSectionTo(store, 'cycling-trip', 'Electronics');

    expect(text('cycling-trip')).toBe('# Cycling trip\n\n- [ ] Multi-tool\n- [ ] Spare tubes\n\n## Electronics\n');
    const after = list('cycling-trip');
    // The flat items keep their own untitled group above the new one.
    expect(after.sections.map((s) => s.title)).toEqual([undefined, 'Electronics']);
    expect(after.sections[0].items).toHaveLength(2);
  });

  it('takes items into the new group once it exists', async () => {
    await addChecklistSectionTo(store, 'cycling-trip', 'Electronics');
    await addChecklistItemTo(store, 'cycling-trip', 1, 'Head unit charger');

    const after = list('cycling-trip');
    expect(after.sections[0].items.map((i) => i.text)).toEqual(['Multi-tool', 'Spare tubes']);
    expect(after.sections[1].items.map((i) => i.text)).toEqual(['Head unit charger']);
  });

  it('adds a group to a list that already has them', async () => {
    await addChecklistSectionTo(store, 'release', 'Afterwards');
    expect(list('release').sections.map((s) => s.title)).toEqual(['Steps', 'After', 'Afterwards']);
  });

  it('renames a heading and leaves its items alone', async () => {
    const section = list('release').sections[0];
    await renameChecklistSectionAt(store, 'release', section.line!, 'The steps');

    const after = list('release');
    expect(after.sections.map((s) => s.title)).toEqual(['The steps', 'After']);
    expect(after.sections[0].items).toHaveLength(3);
    expect(text('release')).toContain('## The steps');
  });

  it('deletes a group with the items under it, and nothing beyond it', async () => {
    const section = list('release').sections[0];
    await deleteChecklistSection(store, 'release', section.line!);

    const after = list('release');
    expect(after.sections.map((s) => s.title)).toEqual(['After']);
    expect(after.sections[0].items.map((i) => i.text)).toEqual(['Announce it']);
    // The title, the stamp and the prose above the first heading survive.
    expect(text('release')).toContain('# Release checklist');
    expect(text('release')).toContain('- last run: 2026-08-12');
    expect(text('release')).toContain('Run this from a clean checkout.');
    expect(text('release')).not.toContain('Bump the version');
  });

  it('deletes the last group without eating the file', async () => {
    const section = list('release').sections[1];
    await deleteChecklistSection(store, 'release', section.line!);

    expect(list('release').sections.map((s) => s.title)).toEqual(['Steps']);
    expect(text('release')).toContain('* [ ] Tag it');
    expect(text('release').endsWith('\n')).toBe(true);
  });

  it('ignores a line that is not a heading', async () => {
    const before = text('release');
    const item = list('release').sections[0].items[0];
    await deleteChecklistSection(store, 'release', item.line);
    expect(text('release')).toBe(before);
  });
});

describe('reordering', () => {
  it('moves an item down past the one after it', async () => {
    await moveChecklistItemTo(store, 'cycling-trip', list('cycling-trip').sections[0].items[0].line, 0, 2);
    expect(text('cycling-trip')).toBe('# Cycling trip\n\n- [ ] Spare tubes\n- [ ] Multi-tool\n');
  });

  it('moves an item back up', async () => {
    await moveChecklistItemTo(store, 'cycling-trip', list('cycling-trip').sections[0].items[1].line, 0, 0);
    expect(text('cycling-trip')).toBe('# Cycling trip\n\n- [ ] Spare tubes\n- [ ] Multi-tool\n');
  });

  it('leaves the file alone when the item lands where it already is', async () => {
    const before = text('cycling-trip');
    await moveChecklistItemTo(store, 'cycling-trip', list('cycling-trip').sections[0].items[0].line, 0, 0);
    await moveChecklistItemTo(store, 'cycling-trip', list('cycling-trip').sections[0].items[0].line, 0, 1);
    expect(text('cycling-trip')).toBe(before);
  });

  // The item keeps its own bullet rather than adopting the destination's: it is
  // the same line, moved.
  it('moves an item into another section, bullet and all', async () => {
    const tag = list('release').sections[0].items[2];
    expect(tag.text).toBe('Tag it');
    await moveChecklistItemTo(store, 'release', tag.line, 1, 1);
    expect(text('release')).toBe(`# Release checklist
- last run: 2026-08-12

Run this from a clean checkout. See [the runbook](https://example.com/runbook).

## Steps
- [ ] Bump the version
- [x] Update the changelog
  - the entry goes under today's date

## After
- [ ] Announce it
* [ ] Tag it
`);
    expect(list('release').sections[1].items.map((i) => i.text)).toEqual(['Announce it', 'Tag it']);
  });

  it('takes an item into a section that has nothing in it yet', async () => {
    await addChecklistSectionTo(store, 'cycling-trip', 'Tools');
    await moveChecklistItemTo(store, 'cycling-trip', list('cycling-trip').sections[0].items[0].line, 1, 0);
    expect(text('cycling-trip')).toBe('# Cycling trip\n\n- [ ] Spare tubes\n\n## Tools\n- [ ] Multi-tool\n');
  });

  it('moves a section past the next one, keeping them apart', async () => {
    await moveChecklistSectionBy(store, 'release', list('release').sections[0].line!, 1);
    expect(text('release')).toBe(`# Release checklist
- last run: 2026-08-12

Run this from a clean checkout. See [the runbook](https://example.com/runbook).

## After
- [ ] Announce it

## Steps
- [ ] Bump the version
- [x] Update the changelog
  - the entry goes under today's date
* [ ] Tag it
`);
  });

  it('moves a section back up', async () => {
    await moveChecklistSectionBy(store, 'release', list('release').sections[1].line!, -1);
    expect(list('release').sections.map((s) => s.title)).toEqual(['After', 'Steps']);
  });

  it('has nothing above the first section to move it past', async () => {
    const before = text('release');
    await moveChecklistSectionBy(store, 'release', list('release').sections[0].line!, -1);
    await moveChecklistSectionBy(store, 'release', list('release').sections[1].line!, 1);
    expect(text('release')).toBe(before);
  });
});

describe('duplicating a list', () => {
  it('copies it unticked, with no last run and a name of its own', async () => {
    const copy = await duplicateChecklist(store, 'release');
    expect(copy?.id).toBe('release-checklist-copy');
    expect(copy?.name).toBe('Release checklist copy');
    expect(copy?.lastRun).toBeUndefined();
    expect(checklistProgress(copy!)).toEqual({ done: 0, total: 4 });
    // The prose, the nesting and the `*` bullet come along.
    expect(text('release-checklist-copy')).toContain('See [the runbook](https://example.com/runbook)');
    expect(text('release-checklist-copy')).toContain("  - the entry goes under today's date");
    expect(text('release-checklist-copy')).toContain('* [ ] Tag it');
  });

  it('leaves the original as the record of the run just finished', async () => {
    await setChecklistItem(store, 'cycling-trip', list('cycling-trip').sections[0].items[0].line, true);
    await duplicateChecklist(store, 'cycling-trip');
    expect(checklistProgress(list('cycling-trip'))).toEqual({ done: 1, total: 2 });
    expect(checklistProgress(list('cycling-trip-copy'))).toEqual({ done: 0, total: 2 });
  });

  it('gives a second copy its own file', async () => {
    await duplicateChecklist(store, 'cycling-trip');
    await duplicateChecklist(store, 'cycling-trip');
    expect(store.db.getAllChecklists().map((l) => l.id)).toContain('cycling-trip-copy-2');
  });
});

describe('starting again', () => {
  it('unticks everything and stamps the run that just ended', async () => {
    await startChecklistAgain(store, 'release', '2026-08-29');
    const after = list('release');
    expect(checklistProgress(after)).toEqual({ done: 0, total: 4 });
    expect(after.lastRun).toBe('2026-08-29');
    expect(text('release')).toContain('- last run: 2026-08-29');
    // Exactly one stamp, and the prose is still there.
    expect(text('release').match(/- last run:/g)).toHaveLength(1);
    expect(text('release')).toContain('Run this from a clean checkout.');
  });

  it('adds the stamp under the title on a list that has never been run', async () => {
    await startChecklistAgain(store, 'cycling-trip', '2026-08-29');
    expect(text('cycling-trip')).toBe('# Cycling trip\n- last run: 2026-08-29\n\n- [ ] Multi-tool\n- [ ] Spare tubes\n');
  });
});

describe('syncing a list', () => {
  it('is a path the app will read and write', () => {
    expect(isWorklogPath('lists/release.md')).toBe(true);
    expect(isWorklogPath('lists/nested/deep.md')).toBe(false);
  });

  it('splits into one record per item, keyed by its words', () => {
    const { header, records } = splitChecklistItems(RELEASE_MD);
    expect(header).toContain('# Release checklist');
    expect(header).toContain('## Steps');
    expect(records.map((r) => r.key)).toEqual([
      'item:1:Bump the version',
      'item:1:Update the changelog',
      'item:1:Tag it',
      'item:1:Announce it',
    ]);
    // The second section's heading rides with the item under it.
    expect(records[3].text).toContain('## After');
  });

  it('keeps both of two identically worded items', () => {
    const { records } = splitChecklistItems('# L\n- [ ] Charger\n- [ ] Charger\n');
    expect(records.map((r) => r.key)).toEqual(['item:1:Charger', 'item:2:Charger']);
  });

  it('merges two devices ticking different items on the same trip', () => {
    const local = PACKING_MD.replace('- [ ] Multi-tool', '- [x] Multi-tool');
    const remote = PACKING_MD.replace('- [ ] Spare tubes', '- [x] Spare tubes');

    const merged = mergeFile('lists/cycling-trip.md', { base: PACKING_MD, local, remote });

    expect(merged.conflicts).toEqual([]);
    expect(merged.text).toBe('# Cycling trip\n\n- [x] Multi-tool\n- [x] Spare tubes\n');
  });

  it('keeps an item each side added, and the one they both ticked', () => {
    const local = PACKING_MD.replace('- [ ] Spare tubes', '- [x] Spare tubes\n- [ ] Rain jacket');
    const remote = PACKING_MD.replace('- [ ] Spare tubes', '- [x] Spare tubes\n- [ ] Helmet');

    const merged = mergeFile('lists/cycling-trip.md', { base: PACKING_MD, local, remote });

    expect(merged.conflicts).toEqual([]);
    expect(merged.text).toContain('- [x] Spare tubes');
    expect(merged.text).toContain('- [ ] Rain jacket');
    expect(merged.text).toContain('- [ ] Helmet');
  });

  // Items are keyed by their words, so a reword is structurally a delete plus an
  // add. Both wordings survive rather than one being chosen — the failure mode
  // is a duplicate you delete, never a line that vanishes.
  it('keeps both wordings when two devices reword the same item', () => {
    const local = PACKING_MD.replace('- [ ] Multi-tool', '- [ ] Multi-tool and chain breaker');
    const remote = PACKING_MD.replace('- [ ] Multi-tool', '- [ ] Multitool');

    const merged = mergeFile('lists/cycling-trip.md', { base: PACKING_MD, local, remote });

    expect(merged.text).toContain('- [ ] Multi-tool and chain breaker');
    expect(merged.text).toContain('- [ ] Multitool');
    expect(merged.conflicts).toEqual([]);
  });

  it('keeps the tick when one device reworded the item the other ticked', () => {
    const local = PACKING_MD.replace('- [ ] Multi-tool', '- [ ] Multitool');
    const remote = PACKING_MD.replace('- [ ] Multi-tool', '- [x] Multi-tool');

    const merged = mergeFile('lists/cycling-trip.md', { base: PACKING_MD, local, remote });

    expect(merged.text).toContain('- [x] Multi-tool');
    expect(merged.text).toContain('- [ ] Multitool');
    expect(merged.conflicts[0]).toContain('"Multi-tool"');
  });

  // Reordering changes no record's text, so without the ordered merge the
  // branch's order would quietly put every moved item back.
  it('keeps a reorder the other device knows nothing about', () => {
    const local = '# Cycling trip\n\n- [ ] Spare tubes\n- [ ] Multi-tool\n';
    const remote = PACKING_MD.replace('- [ ] Spare tubes', '- [x] Spare tubes');

    const merged = mergeFile('lists/cycling-trip.md', { base: PACKING_MD, local, remote });

    expect(merged.conflicts).toEqual([]);
    expect(merged.text).toBe('# Cycling trip\n\n- [x] Spare tubes\n- [ ] Multi-tool\n');
  });

  it('keeps your order when both devices reordered, and says so', () => {
    const base = '# Cycling trip\n\n- [ ] Multi-tool\n- [ ] Spare tubes\n- [ ] Pump\n';
    const local = '# Cycling trip\n\n- [ ] Spare tubes\n- [ ] Multi-tool\n- [ ] Pump\n';
    const remote = '# Cycling trip\n\n- [ ] Pump\n- [ ] Multi-tool\n- [ ] Spare tubes\n';

    const merged = mergeFile('lists/cycling-trip.md', { base, local, remote });

    expect(merged.text).toBe(local);
    expect(merged.conflicts[0]).toContain('the order changed here and on GitHub');
  });

  it('says nothing about an order both devices moved the same way', () => {
    const base = '# Cycling trip\n\n- [ ] Multi-tool\n- [ ] Spare tubes\n';
    const local = '# Cycling trip\n\n- [ ] Spare tubes\n- [ ] Multi-tool\n';
    const remote = '# Cycling trip\n\n- [x] Spare tubes\n- [ ] Multi-tool\n';

    const merged = mergeFile('lists/cycling-trip.md', { base, local, remote });

    expect(merged.conflicts).toEqual([]);
    expect(merged.text).toBe(remote);
  });

  it('resolves an unchanged file to itself, so no phantom commit', () => {
    const merged = mergeFile('lists/release.md', { base: RELEASE_MD, local: RELEASE_MD, remote: RELEASE_MD });
    expect(merged.text).toBe(RELEASE_MD);
  });

  it('rebuilds a merged file byte-for-byte when only one side moved', () => {
    const local = RELEASE_MD.replace('- [ ] Announce it', '- [x] Announce it');
    const merged = mergeFile('lists/release.md', { base: RELEASE_MD, local, remote: RELEASE_MD });
    expect(merged.text).toBe(local);
  });
});
