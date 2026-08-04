// The `notes/<YYYY-MM>.md` format: what opens a day block, what stays prose,
// and that reading then writing a file gives the bytes back unchanged.

import { describe, expect, it } from 'vitest';
import { joinDayNotes, parseDayNotesFile, splitDayNoteBlocks, upsertDayNote } from '../src/parser/dayNotes';

const FILE = `# Notes 2026-07

## 2026-07-01

Kickoff with Globex.

- chase the SSO ticket

## 2026-07-16

Export queue prototype.
`;

describe('splitDayNoteBlocks', () => {
  it('splits on bare-date h2 headings and keeps the header', () => {
    const { header, blocks } = splitDayNoteBlocks(FILE);
    expect(header).toBe('# Notes 2026-07');
    expect(blocks.map((b) => b.date)).toEqual(['2026-07-01', '2026-07-16']);
    expect(blocks[0].text).toBe('Kickoff with Globex.\n\n- chase the SSO ticket');
    expect(blocks[1].line).toBe(8);
  });

  it('leaves the body’s own headings alone', () => {
    const { blocks } = splitDayNoteBlocks(
      '## 2026-07-01\n\n## Scripts\n\nprose\n\n### 2026-07-02\n\n## 2026-07-02 planning\n',
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('## Scripts\n\nprose\n\n### 2026-07-02\n\n## 2026-07-02 planning');
  });

  it('treats a bare date heading inside a fence as a heading — the known ambiguity', () => {
    // Documented, not defended against: escaping it on write would stop the file
    // being something a person can hand-edit, which is the point of the format.
    const { blocks } = splitDayNoteBlocks('## 2026-07-01\n\n```md\n## 2026-07-02\n```\n');
    expect(blocks.map((b) => b.date)).toEqual(['2026-07-01', '2026-07-02']);
  });

  it('normalizes CRLF', () => {
    const { blocks } = splitDayNoteBlocks('# Notes\r\n\r\n## 2026-07-01\r\n\r\nline one\r\nline two\r\n');
    expect(blocks[0].text).toBe('line one\nline two');
  });
});

describe('joinDayNotes', () => {
  it('round-trips a canonical file byte for byte', () => {
    const { header, blocks } = splitDayNoteBlocks(FILE);
    expect(joinDayNotes(header, blocks)).toBe(FILE);
  });

  it('is idempotent for arbitrary input', () => {
    const messy = '#  Notes  \n\n\n##   2026-07-01\n\n\n  body  \n\n\n\n## 2026-07-02\n\nmore\n\n\n';
    const once = joinDayNotes(...unpack(messy));
    expect(joinDayNotes(...unpack(once))).toBe(once);
  });

  it('drops blocks with an empty body but keeps the header', () => {
    expect(joinDayNotes('# Notes 2026-07', [{ date: '2026-07-01', text: '   ' }])).toBe('# Notes 2026-07\n');
  });
});

describe('parseDayNotesFile', () => {
  it('yields one record per day, with its heading line', () => {
    const notes = parseDayNotesFile(FILE, 'notes/2026-07.md');
    expect(notes).toEqual([
      { date: '2026-07-01', body: 'Kickoff with Globex.\n\n- chase the SSO ticket', sourceFile: 'notes/2026-07.md', sourceLine: 2 },
      { date: '2026-07-16', body: 'Export queue prototype.', sourceFile: 'notes/2026-07.md', sourceLine: 8 },
    ]);
  });

  it('skips empty blocks and keeps the last of a repeated date', () => {
    const notes = parseDayNotesFile('## 2026-07-01\n\n## 2026-07-02\n\nfirst\n\n## 2026-07-02\n\nsecond\n', 'notes/x.md');
    expect(notes.map((n) => [n.date, n.body])).toEqual([['2026-07-02', 'second']]);
  });

  it('keeps a block whose date belongs to another month', () => {
    // Swallowing it into the previous day's body would be data loss the next
    // save makes permanent; showing it where it is at least lets it be fixed.
    const notes = parseDayNotesFile('## 2026-08-03\n\nstrayed\n', 'notes/2026-07.md');
    expect(notes.map((n) => n.date)).toEqual(['2026-08-03']);
  });
});

describe('upsertDayNote', () => {
  it('creates the file with a heading when there is none', () => {
    expect(upsertDayNote(undefined, '2026-07', '2026-07-04', 'first note')).toBe('# Notes 2026-07\n\n## 2026-07-04\n\nfirst note\n');
  });

  it('replaces an existing day in place', () => {
    const next = upsertDayNote(FILE, '2026-07', '2026-07-01', 'rewritten');
    expect(splitDayNoteBlocks(next).blocks.map((b) => [b.date, b.text])).toEqual([
      ['2026-07-01', 'rewritten'],
      ['2026-07-16', 'Export queue prototype.'],
    ]);
  });

  it('inserts a new day in date order', () => {
    const next = upsertDayNote(FILE, '2026-07', '2026-07-08', 'mid-month');
    expect(splitDayNoteBlocks(next).blocks.map((b) => b.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-16']);
  });

  it('drops the day when the body is blank, keeping the file', () => {
    expect(upsertDayNote(FILE, '2026-07', '2026-07-01', '  \n\n ')).toBe('# Notes 2026-07\n\n## 2026-07-16\n\nExport queue prototype.\n');
    expect(upsertDayNote('# Notes 2026-07\n\n## 2026-07-01\n\nonly one\n', '2026-07', '2026-07-01', '')).toBe('# Notes 2026-07\n');
  });

  it('trims the authored body but preserves its interior blank lines', () => {
    const next = upsertDayNote(undefined, '2026-07', '2026-07-04', '\n\n  one\n\ntwo  \n\n');
    expect(splitDayNoteBlocks(next).blocks[0].text).toBe('  one\n\ntwo');
  });
});

function unpack(content: string): [string, ReturnType<typeof splitDayNoteBlocks>['blocks']] {
  const { header, blocks } = splitDayNoteBlocks(content);
  return [header, blocks];
}
