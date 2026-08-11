// Rendered Markdown, with image refs resolved against the store's in-memory
// asset bytes and `#t_a1b2c3` task refs against the loaded tasks.
//
// It exists to be the *one* place the app hands a string to
// `dangerouslySetInnerHTML`. The escaping lives in `renderMarkdown`; the CSP is
// a backstop, not a licence. Anything that needs to show Markdown goes through
// here rather than repeating the pair — a second copy is a second thing to
// remember when the renderer changes.

import React, { useCallback, useMemo } from 'react';
import { useData } from '../context';
import { cn } from '../primitives';
import { navigateToTask } from '../router';
import { isDone, makeImageResolver, renderMarkdown, toggleTaskLine } from '../utils';

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
  const { assetUrl, tasks } = useData();
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);

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
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
      onClick={onClick}
      dangerouslySetInnerHTML={{
        __html: renderMarkdown(text, resolveImage, { interactiveTasks: !!onTextChange, resolveTaskRef }),
      }}
    />
  );
}
