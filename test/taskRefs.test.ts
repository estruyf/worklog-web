// Task cross-references: what counts as a `#` mention while typing, what picking
// one writes back, and which tasks a query offers.
//
// The rules here are almost entirely about what must *not* trigger — a
// description is Markdown, where `#` already means a heading and a URL fragment,
// and a picker that opened on those would fight the writer on every line.

import { describe, it, expect } from 'vitest';
import { applyMention, matchTaskRefs, mentionAt } from '../src/ui/utils/taskRefs';
import { renderMarkdown } from '../src/ui/utils/markdown';
import type { Task } from '../src/model/types';

function task(id: string, title: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: 'open',
    clientIds: ['acme'],
    links: [],
    sourceFile: 'clients/acme.md',
    sourceLine: 1,
    ...extra,
  } as Task;
}

/** The caret at the end of the text — how a mention is almost always typed. */
const at = (text: string) => mentionAt(text, text.length);

describe('mentionAt', () => {
  it('opens on a bare # and carries what follows it', () => {
    expect(at('Blocked by #')).toEqual({ start: 11, end: 12, query: '' });
    expect(at('Blocked by #auth')).toEqual({ start: 11, end: 16, query: 'auth' });
  });

  it('opens at the very start of the text', () => {
    expect(at('#')).toEqual({ start: 0, end: 1, query: '' });
  });

  it('reads only up to the caret, not the whole text', () => {
    expect(mentionAt('see #auth later', 9)).toEqual({ start: 4, end: 9, query: 'auth' });
  });

  it('allows a space inside the query, so a title can be typed', () => {
    expect(at('#the auth')).toEqual({ start: 0, end: 9, query: 'the auth' });
  });

  it('gives up once the query is longer than a search', () => {
    expect(at('#' + 'a'.repeat(41))).toBeNull();
  });

  it('leaves headings alone', () => {
    expect(at('# ')).toBeNull();
    expect(at('# Notes')).toBeNull();
    expect(at('## Notes')).toBeNull();
    expect(at('Intro\n\n### Sub')).toBeNull();
  });

  it('needs the # to open a word', () => {
    expect(at('https://example.com#anchor')).toBeNull();
    expect(at('C#')).toBeNull();
    expect(at('issue2#3')).toBeNull();
  });

  it('opens after an opening bracket or a quote', () => {
    expect(at('(#au')).toEqual({ start: 1, end: 4, query: 'au' });
    expect(at('"#au')).toEqual({ start: 1, end: 4, query: 'au' });
  });

  it('stops at the end of the line', () => {
    expect(at('#auth\nnext line')).toBeNull();
  });

  it('leaves code alone', () => {
    expect(at('`#au')).toBeNull();
    expect(at('```\n#au')).toBeNull();
    // A closed fence is not code any more.
    expect(at('```\nx\n```\n#au')).toEqual({ start: 10, end: 13, query: 'au' });
    // A closed span is not either.
    expect(at('`x` #au')).toEqual({ start: 4, end: 7, query: 'au' });
  });

  it('closes once the ref is finished, so the space after a pick does not reopen it', () => {
    expect(at('Blocked by #t_a1b2c3')).not.toBeNull();
    expect(at('Blocked by #t_a1b2c3 ')).toBeNull();
    expect(at('Blocked by #t_a1b2c3 and more text')).toBeNull();
    expect(at('Blocked by #t_a1b2c3.')).toBeNull();
  });
});

describe('applyMention', () => {
  it('replaces the query with the ref and leaves the caret after it', () => {
    const text = 'Blocked by #au';
    const mention = at(text)!;
    expect(applyMention(text, mention, 't_a1b2c3')).toEqual({ text: 'Blocked by #t_a1b2c3 ', caret: 21 });
  });

  it('keeps what follows the caret', () => {
    const text = 'Blocked by #au until Friday';
    const mention = mentionAt(text, 14)!;
    expect(applyMention(text, mention, 't_a1b2c3').text).toBe('Blocked by #t_a1b2c3 until Friday');
  });

  it('does not double the space when there already is one', () => {
    const text = 'Blocked by # today';
    const mention = mentionAt(text, 12)!;
    expect(applyMention(text, mention, 't_a1b2c3')).toEqual({ text: 'Blocked by #t_a1b2c3 today', caret: 20 });
  });

  it('writes a ref the parser can read straight back', () => {
    const text = 'x #a';
    const out = applyMention(text, at(text)!, 't_a1b2c3').text;
    expect(mentionAt(out, out.length)).toBeNull();
  });
});

describe('matchTaskRefs', () => {
  const tasks = [
    task('t_done01', 'Auth cleanup', { completed: '2026-08-01', status: 'done' }),
    task('t_open01', 'Rework the auth API'),
    task('t_open02', 'Auth token refresh'),
    task('t_open03', 'Invoice run'),
  ];

  it('offers everything when nothing has been typed yet', () => {
    expect(matchTaskRefs(tasks, '').map((t) => t.id)).toEqual(['t_open01', 't_open02', 't_open03', 't_done01']);
  });

  it('matches the title, case-insensitively, prefix first and open before done', () => {
    expect(matchTaskRefs(tasks, 'auth').map((t) => t.id)).toEqual(['t_open02', 't_open01', 't_done01']);
  });

  it('matches the id, so a known ref resolves without its title', () => {
    expect(matchTaskRefs(tasks, 't_open03').map((t) => t.id)).toEqual(['t_open03']);
  });

  it('leaves out the task being written', () => {
    expect(matchTaskRefs(tasks, 'auth', 't_open02').map((t) => t.id)).toEqual(['t_open01', 't_done01']);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 20 }, (_, i) => task(`t_x${i}`, `Task ${i}`));
    expect(matchTaskRefs(many, '')).toHaveLength(8);
  });
});

describe('renderMarkdown task refs', () => {
  const resolve = (id: string) =>
    id === 't_a1b2c3' ? { title: 'Rework the auth API', done: false } : id === 't_done01' ? { title: 'Old thing', done: true } : null;
  const render = (md: string) => renderMarkdown(md, undefined, { resolveTaskRef: resolve });

  it('renders the task title, linked to its route', () => {
    expect(render('Blocked by #t_a1b2c3 until Friday')).toContain(
      '<a href="/app/task/t_a1b2c3" data-task-ref="t_a1b2c3" class="wl-md-taskref" title="#t_a1b2c3">Rework the auth API</a>',
    );
  });

  it('marks a closed task', () => {
    expect(render('See #t_done01')).toContain('class="wl-md-taskref wl-md-taskref-done"');
  });

  it('leaves an unknown id as the text the user typed', () => {
    expect(render('See #t_gone11')).toBe('<p>See #t_gone11</p>');
  });

  it('renders nothing special without a resolver', () => {
    expect(renderMarkdown('See #t_a1b2c3')).toBe('<p>See #t_a1b2c3</p>');
  });

  it('escapes the title it inserts', () => {
    const html = renderMarkdown('See #t_evil01', undefined, {
      resolveTaskRef: () => ({ title: '<img src=x onerror=alert(1)>', done: false }),
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('leaves code alone', () => {
    expect(render('Use `#t_a1b2c3` literally')).toContain('<code class="wl-md-code">#t_a1b2c3</code>');
    expect(render('```\n#t_a1b2c3\n```')).toContain('<code class="wl-md-codeblock">#t_a1b2c3</code>');
  });

  it('leaves a URL fragment inside a link alone', () => {
    const html = render('https://example.com/x#t_a1b2c3');
    expect(html).toContain('href="https://example.com/x#t_a1b2c3"');
    expect(html).not.toContain('data-task-ref');
  });

  it('resolves refs in headings, quotes and list items', () => {
    expect(render('## #t_a1b2c3')).toContain('data-task-ref');
    expect(render('> #t_a1b2c3')).toContain('data-task-ref');
    expect(render('- #t_a1b2c3')).toContain('data-task-ref');
  });

  it('reads a checkbox item out by title rather than by id', () => {
    expect(render('- [ ] follow #t_a1b2c3')).toContain('aria-label="follow Rework the auth API"');
  });
});
