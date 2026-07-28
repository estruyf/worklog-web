// Golden round-trip tests over a timesheet repo laid out on disk. These guard the
// single most important property of the app: the parser/serializer is faithful,
// so commits stay diff-clean and the Markdown stays portable.
//
// By default they run against the committed fixture repo in test/fixtures/timesheet
// so the suite is self-contained. Point WORKLOG_DATA_DIR at a real timesheet repo
// to run the same assertions over live data.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTaskFile, serializeTask } from '../src/parser/taskParser';
import { parseWorklogFile, serializeWorklogEntry } from '../src/parser/worklogParser';
import { replaceBlock, extractBlock } from '../src/parser/blocks';
import type { Task } from '../src/model/types';

const FIXTURES = fileURLToPath(new URL('./fixtures/timesheet', import.meta.url));
const DATA = process.env.WORKLOG_DATA_DIR ?? FIXTURES;

function taskFiles(): { path: string; clientId: string }[] {
  const out: { path: string; clientId: string }[] = [];
  const clientsDir = join(DATA, 'clients');
  if (existsSync(clientsDir)) {
    for (const f of readdirSync(clientsDir).filter((f) => f.endsWith('.md'))) {
      out.push({ path: join(clientsDir, f), clientId: f.replace(/\.md$/, '') });
    }
  }
  const archiveDir = join(DATA, 'archive');
  if (existsSync(archiveDir)) {
    for (const client of readdirSync(archiveDir)) {
      const dir = join(archiveDir, client);
      try {
        for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
          out.push({ path: join(dir, f), clientId: client });
        }
      } catch {
        /* not a directory */
      }
    }
  }
  return out;
}

/** Compare the structured fields that must survive a round-trip (ignore source location). */
function taskShape(t: Task) {
  const { sourceFile: _s, sourceLine: _l, ...rest } = t;
  return rest;
}

describe('task file round-trip', () => {
  const files = taskFiles();
  it('finds task files to test', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { path, clientId } of files) {
    it(`parse→serialize→parse is stable for ${path}`, () => {
      const content = readFileSync(path, 'utf-8');
      const parsed = parseTaskFile(content, path, clientId);
      for (const task of parsed.tasks) {
        const reparsed = parseTaskFile(serializeTask(task, clientId), path, clientId).tasks[0];
        expect(taskShape(reparsed)).toEqual(taskShape(task));
      }
    });

    it(`replaceBlock preserves other tasks in ${path}`, () => {
      const content = readFileSync(path, 'utf-8');
      const parsed = parseTaskFile(content, path, clientId);
      if (parsed.tasks.length < 1) {
        return;
      }
      const target = parsed.tasks[0];
      const replaced = replaceBlock(content, target.id, serializeTask(target, clientId));
      expect(replaced).toBeDefined();
      const after = parseTaskFile(replaced!, path, clientId);
      // Same set of task ids, same count — nothing dropped or duplicated.
      expect(after.tasks.map((t) => t.id).sort()).toEqual(parsed.tasks.map((t) => t.id).sort());
    });

    it(`extractBlock removes exactly one task in ${path}`, () => {
      const content = readFileSync(path, 'utf-8');
      const parsed = parseTaskFile(content, path, clientId);
      if (parsed.tasks.length < 1) {
        return;
      }
      const target = parsed.tasks[0];
      const extracted = extractBlock(content, target.id);
      expect(extracted).toBeDefined();
      const remaining = parseTaskFile(extracted!.remainder, path, clientId);
      expect(remaining.tasks.find((t) => t.id === target.id)).toBeUndefined();
      expect(remaining.tasks.length).toBe(parsed.tasks.length - 1);
    });
  }
});

describe('worklog ledger round-trip', () => {
  const worklogDir = join(DATA, 'worklog');
  const files = existsSync(worklogDir) ? readdirSync(worklogDir).filter((f) => f.endsWith('.md')) : [];

  it('finds worklog files to test', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`serialize(parse) reproduces every entry in ${f}`, () => {
      const path = join(worklogDir, f);
      const content = readFileSync(path, 'utf-8');
      const entries = parseWorklogFile(content, path);
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        const line = serializeWorklogEntry(e);
        const reparsed = parseWorklogFile(line, path)[0];
        expect({ date: reparsed.date, clientId: reparsed.clientId, hours: reparsed.hours, note: reparsed.note }).toEqual({
          date: e.date,
          clientId: e.clientId,
          hours: e.hours,
          note: e.note,
        });
      }
    });
  }
});
