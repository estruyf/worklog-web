// The Markdown toolbar's edits: what ⌘B does to a selection, what Enter does
// inside a list.
//
// Two things are asserted everywhere: the text, and where the selection lands.
// A wrapper that puts the caret outside the markers it just wrote is one the
// next keystroke types past — the offsets are half of what makes the field feel
// like an editor rather than a textarea.

import { describe, it, expect } from 'vitest';
import { continueList, insertLink, toggleLinePrefix, toggleWrap } from '../src/ui/utils/markdownEdit';
import { renderMarkdown } from '../src/ui/utils/markdown';

/** `|` marks a caret and `«…»` a selection, so the fixtures read as what is on
 *  screen. Guillemets rather than brackets: half these fixtures are task items,
 *  and `- [ ]` would be indistinguishable from a selected space. */
function at(marked: string): { text: string; start: number; end: number } {
  const open = marked.indexOf('«');
  if (open >= 0) {
    const close = marked.indexOf('»', open);
    return { text: marked.slice(0, open) + marked.slice(open + 1, close) + marked.slice(close + 1), start: open, end: close - 1 };
  }
  const caret = marked.indexOf('|');
  return { text: marked.slice(0, caret) + marked.slice(caret + 1), start: caret, end: caret };
}

/** The result in the same notation, so an expectation is one string. */
function show(edit: { text: string; start: number; end: number } | null): string | null {
  if (!edit) {
    return null;
  }
  const { text, start, end } = edit;
  return start === end
    ? text.slice(0, start) + '|' + text.slice(start)
    : text.slice(0, start) + '«' + text.slice(start, end) + '»' + text.slice(end);
}

const wrap = (marked: string, marker: '**' | '*' | '`' | '~~') => {
  const { text, start, end } = at(marked);
  return show(toggleWrap(text, start, end, marker));
};

const prefix = (marked: string, kind: 'bullet' | 'ordered' | 'task' | 'quote') => {
  const { text, start, end } = at(marked);
  return show(toggleLinePrefix(text, start, end, kind));
};

const enter = (marked: string) => {
  const { text, start } = at(marked);
  return show(continueList(text, start));
};

describe('toggleWrap', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrap('make «this» bold', '**')).toBe('make **«this»** bold');
    expect(wrap('make «this» loud', '~~')).toBe('make ~~«this»~~ loud');
  });

  it('unwraps when the markers are inside the selection', () => {
    expect(wrap('make «**this**» plain', '**')).toBe('make «this» plain');
  });

  it('unwraps when the markers sit just outside it — selecting the word is the same request', () => {
    expect(wrap('make **«this»** plain', '**')).toBe('make «this» plain');
  });

  it('formats the word the caret is in when nothing is selected', () => {
    expect(wrap('make th|is bold', '**')).toBe('make **«this»** bold');
    expect(wrap('make **th|is** plain', '**')).toBe('make «this» plain');
  });

  it('leaves an empty pair to type into when the caret is in whitespace', () => {
    expect(wrap('start | end', '**')).toBe('start **|** end');
  });

  it('adds italics to a bold word rather than eating one of bold’s stars', () => {
    expect(wrap('a **«word»** here', '*')).toBe('a ***«word»*** here');
    expect(wrap('a «**word**» here', '*')).toBe('a *«**word**»* here');
    // …and takes only its own back off again.
    expect(wrap('a ***«word»*** here', '*')).toBe('a **«word»** here');
  });

  it('fences a code selection that spans lines, and unfences it', () => {
    expect(wrap('run\n«one\ntwo»\nnow', '`')).toBe('run\n```\n«one\ntwo»\n```\nnow');
    expect(wrap('run\n«```\none\ntwo\n```»\nnow', '`')).toBe('run\n«one\ntwo»\nnow');
  });

  it('stays inline for a code selection on one line', () => {
    expect(wrap('call «npm test» now', '`')).toBe('call `«npm test»` now');
  });
});

describe('toggleLinePrefix', () => {
  it('marks every line the selection touches', () => {
    expect(prefix('«one\ntwo»', 'bullet')).toBe('«- one\n- two»');
    expect(prefix('«one\ntwo»', 'ordered')).toBe('«1. one\n2. two»');
    expect(prefix('«one\ntwo»', 'task')).toBe('«- [ ] one\n- [ ] two»');
  });

  it('marks the line the caret is on, and moves the caret with it', () => {
    expect(prefix('on|e', 'bullet')).toBe('- on|e');
  });

  it('starts a list on an empty field', () => {
    expect(prefix('|', 'bullet')).toBe('- |');
  });

  it('takes the marker back off when every line already has it', () => {
    expect(prefix('«- one\n- two»', 'bullet')).toBe('«one\ntwo»');
    expect(prefix('«1. one\n2. two»', 'ordered')).toBe('«one\ntwo»');
  });

  it('completes a partly marked selection instead of inverting it line by line', () => {
    expect(prefix('«- one\ntwo»', 'bullet')).toBe('«- one\n- two»');
  });

  it('swaps one list kind for another rather than nesting them', () => {
    expect(prefix('«- one\n- two»', 'ordered')).toBe('«1. one\n2. two»');
    expect(prefix('«- [ ] one»', 'bullet')).toBe('«- one»');
    expect(prefix('«- one»', 'task')).toBe('«- [ ] one»');
  });

  it('keeps indentation, so a nested item stays nested', () => {
    expect(prefix('- one\n  «two»', 'bullet')).toBe('- one\n  «- two»');
  });

  it('quotes a list without eating it', () => {
    expect(prefix('«- one»', 'quote')).toBe('«> - one»');
    expect(prefix('«> - one»', 'quote')).toBe('«- one»');
  });

  it('stops at the line above a selection that ends on a break', () => {
    const { text, start, end } = at('«one\n»two');
    expect(toggleLinePrefix(text, start, end, 'bullet').text).toBe('- one\ntwo');
  });

  it('writes a list the renderer reads back as one', () => {
    const { text, start, end } = at('«one\ntwo»');
    expect(renderMarkdown(toggleLinePrefix(text, start, end, 'bullet').text)).toContain('<li>');
  });
});

describe('insertLink', () => {
  const link = (marked: string) => {
    const { text, start, end } = at(marked);
    return show(insertLink(text, start, end));
  };

  it('makes the selection the label, with the caret in the empty target', () => {
    expect(link('see «the docs» here')).toBe('see [the docs](|) here');
  });

  it('makes a selected URL the target, with the caret in the empty label', () => {
    expect(link('see «https://example.com» here')).toBe('see [|](https://example.com) here');
  });

  it('leaves both halves empty when there is no selection', () => {
    expect(link('see | here')).toBe('see [|]() here');
  });
});

describe('continueList', () => {
  it('carries a bullet onto the next line', () => {
    expect(enter('- one|')).toBe('- one\n- |');
    expect(enter('* one|')).toBe('* one\n* |');
  });

  it('counts on for a numbered list', () => {
    expect(enter('1. one|')).toBe('1. one\n2. |');
    expect(enter('9) nine|')).toBe('9) nine\n10) |');
  });

  it('opens a fresh box for a task list, ticked or not', () => {
    expect(enter('- [ ] one|')).toBe('- [ ] one\n- [ ] |');
    expect(enter('- [x] done|')).toBe('- [x] done\n- [ ] |');
  });

  it('carries a quote', () => {
    expect(enter('> quoted|')).toBe('> quoted\n> |');
  });

  it('keeps the indentation of a nested item', () => {
    expect(enter('  - one|')).toBe('  - one\n  - |');
  });

  it('ends the list on an empty item rather than writing another marker', () => {
    expect(enter('- one\n- |')).toBe('- one\n|');
    expect(enter('1. one\n2. |')).toBe('1. one\n|');
    expect(enter('> |')).toBe('|');
  });

  it('splits an item when the caret is mid-line', () => {
    expect(enter('- one|two')).toBe('- one\n- |two');
  });

  it('leaves an ordinary line to the browser', () => {
    expect(enter('just text|')).toBe(null);
    expect(enter('|')).toBe(null);
    // A caret still inside the marker is typing it, not continuing it.
    expect(enter('-| one')).toBe(null);
  });
});
