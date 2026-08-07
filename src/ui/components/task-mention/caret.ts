// Where the caret sits on screen, in viewport coordinates — the anchor for the
// `#` picker's panel.
//
// A textarea exposes no geometry for its own text, so this is the mirror trick:
// an off-screen div wearing the textarea's type and box metrics, filled with the
// text up to the caret. A marker span appended at the end lands exactly where
// the caret is, and its offset within the mirror is the offset within the field.
//
// Owned by the mention picker; nothing else needs it. Copying the metrics rather
// than assuming them matters here, because the two editors this serves are not
// styled alike — one is monospaced with its own padding, the other is a plain
// control from `primitives/`.

/**
 * Everything that decides where a character lands. Any of these left out shows
 * up as a panel that drifts further from the caret the longer the text gets.
 */
const METRICS = [
  'box-sizing',
  'width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'font-size',
  'font-family',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-indent',
  'text-transform',
  'tab-size',
  'word-break',
];

export interface CaretPoint {
  left: number;
  top: number;
  /** The line's height, so a caller can clear the line it hangs off. */
  height: number;
}

export function caretPoint(el: HTMLTextAreaElement, index: number): CaretPoint {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement('div');
  for (const prop of METRICS) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop));
  }
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  mirror.style.visibility = 'hidden';
  // The field's own wrapping, and a height that follows the text rather than the
  // field — the marker has to be laid out even when the caret is scrolled out of
  // view, which is exactly when the panel most needs a position.
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.height = 'auto';
  mirror.textContent = el.value.slice(0, index);

  const marker = document.createElement('span');
  // Non-empty, or a trailing newline collapses and the marker reports the
  // previous line's position.
  marker.textContent = el.value.slice(index) || '.';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const left = marker.offsetLeft;
  const top = marker.offsetTop;
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  document.body.removeChild(mirror);

  const box = el.getBoundingClientRect();
  return { left: box.left + left - el.scrollLeft, top: box.top + top - el.scrollTop, height: lineHeight };
}
