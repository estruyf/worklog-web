// Rendered Markdown, with image refs resolved against the store's in-memory
// asset bytes.
//
// It exists to be the *one* place the app hands a string to
// `dangerouslySetInnerHTML`. The escaping lives in `renderMarkdown`; the CSP is
// a backstop, not a licence. Anything that needs to show Markdown goes through
// here rather than repeating the pair — a second copy is a second thing to
// remember when the renderer changes.

import React, { useMemo } from 'react';
import { useData } from '../context';
import { cn } from '../primitives';
import { makeImageResolver, renderMarkdown } from '../utils';

export interface MarkdownViewProps {
  text: string;
  /** Layout and type scale only; `wl-md` supplies the prose styling. */
  className?: string;
}

export function MarkdownView({ text, className }: MarkdownViewProps) {
  const { assetUrl } = useData();
  const resolveImage = useMemo(() => makeImageResolver(assetUrl), [assetUrl]);
  return <div className={cn('wl-md', className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(text, resolveImage) }} />;
}
