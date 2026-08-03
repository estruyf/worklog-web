import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { IconButton } from '../primitives';

export interface CopyButtonProps {
  /** The text put on the clipboard, verbatim. */
  value: string;
  /** The button's accessible name — it has no text of its own. */
  label: string;
  className?: string;
}

/** Copies a string to the clipboard and confirms it on the button itself.
 *
 *  The confirmation is local state rather than the app's Toast: that one is the
 *  sync channel, and a copy is not something the store knows about. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Denied permission or an insecure context: nothing to report, and a
      // failed copy leaves the button as it was.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <IconButton
      size="xs"
      onClick={copy}
      title={copied ? 'Copied' : label}
      aria-label={label}
      className={className}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </IconButton>
  );
}
