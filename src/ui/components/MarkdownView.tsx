// Rendered Markdown, with image refs resolved against the store's in-memory
// asset bytes and `#t_a1b2c3` task refs against the loaded tasks.
//
// It exists to be the *one* place the app hands a string to
// `dangerouslySetInnerHTML`. The escaping lives in `renderMarkdown`; the CSP is
// a backstop, not a licence. Anything that needs to show Markdown goes through
// here rather than repeating the pair — a second copy is a second thing to
// remember when the renderer changes.
//
// It is also the only caller that highlights fenced code: the grammars are
// fetched lazily (see ../utils/highlight), so the view has to re-render when one
// lands, and that is what the subscription below is for.

import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useData } from '../context';
import { cn } from '../primitives';
import { navigateToTask } from '../router';
import { highlightCode, highlightVersion, isDone, makeImageResolver, renderMarkdown, subscribeHighlight, toggleTaskLine } from '../utils';

export interface MarkdownViewProps {
  text: string;
  /** Layout and type scale only; `wl-md` supplies the prose styling. */
  className?: string;
  /** Makes `- [ ]` items tickable. Receives the whole Markdown with that one
   *  line flipped — the caller decides whether that is a draft or a save.
   *  Without it the boxes render read-only. */
  onTextChange?: (next: string) => void;
}

export function MarkdownView({ text, className, onTextChange }: MarkdownViewProps) {
  const { assetUrl, codeTheme, tasks } = useData();
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);

  // Clears the copy button's confirmation. Held here rather than in the button
  // because the button is markup inside `dangerouslySetInnerHTML`, not a
  // component — see `copyCode` below.
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  // A fenced block renders plain the first time its grammar is asked for, and
  // the grammar arrives a chunk-load later. Subscribing to that is what turns
  // the plain block into a highlighted one; the counter is the whole state.
  useSyncExternalStore(subscribeHighlight, highlightVersion, () => 0);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const resolveTaskRef = useCallback(
    (id: string) => {
      const task = byId.get(id);
      return task ? { title: task.title, done: isDone(task) } : null;
    },
    [byId],
  );

  // The rendered markup is the *output* of the text, so a checkbox click never
  // gets to set the box: it is cancelled, the source line is flipped, and the
  // re-render decides what the box shows. A toggle the caller drops therefore
  // visibly does nothing, rather than showing a tick that was never written to
  // Markdown.
  /** The block's own text to the clipboard, confirmed on the button itself.
   *
   *  Written straight into the DOM, which the rest of this file is careful not
   *  to do — but the Markdown is still the source of truth here: what this
   *  touches is a `data-` flag on a button that exists only in the rendered
   *  output. The alternative, a React `CopyButton` portalled into markup React
   *  replaces wholesale, breaks the moment the two disagree about that node. */
  const copyCode = (button: HTMLElement) => {
    const code = button.parentElement?.querySelector('code')?.textContent ?? '';
    void (async () => {
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        // Denied permission or an insecure context: nothing to report, and the
        // button stays as it was.
        return;
      }
      button.dataset.copied = 'true';
      button.title = 'Copied';
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => {
        delete button.dataset.copied;
        button.title = 'Copy code';
      }, 1500);
    })();
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const copy = (e.target as HTMLElement).closest?.('[data-md-copy]');
    if (copy instanceof HTMLElement) {
      e.preventDefault();
      // Stopped, unlike the two below: a description can sit inside a row that
      // opens something on click, and copying a snippet is not asking for that.
      e.stopPropagation();
      copyCode(copy);
      return;
    }
    const ref = (e.target as HTMLElement).closest?.('[data-task-ref]');
    if (ref instanceof HTMLElement) {
      // A modified click is the browser's: the ref carries the task's own route
      // as its href precisely so it can be opened in a tab of its own.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      e.preventDefault();
      const id = ref.dataset.taskRef;
      if (id) {
        navigateToTask(id);
      }
      return;
    }
    const line = (e.target as HTMLElement).dataset?.mdLine;
    if (!onTextChange || line === undefined) {
      return;
    }
    e.preventDefault();
    const next = toggleTaskLine(text, Number(line));
    if (next !== null) {
      onTextChange(next);
    }
  };

  return (
    <div
      className={cn('wl-md', className)}
      // Which of the two themes the code blocks below paint with. An attribute
      // rather than a prop on the renderer: both are in the markup, so the
      // switch is CSS and costs no re-highlighting.
      data-code-theme={codeTheme}
      onClick={onClick}
      dangerouslySetInnerHTML={{
        __html: renderMarkdown(text, resolveImage, {
          interactiveTasks: !!onTextChange,
          resolveTaskRef,
          highlight: highlightCode,
          copyableCode: true,
        }),
      }}
    />
  );
}
