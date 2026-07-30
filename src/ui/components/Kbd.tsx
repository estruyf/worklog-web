import React from 'react';

/** A small keyboard-key hint chip, e.g. ⌘F or ↵. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[5px] rounded-[5px] border border-neutral-425 bg-neutral-200 text-neutral-700 text-[11px] font-medium leading-none shadow-[0_1px_0_var(--color-neutral-425)]">
      {children}
    </kbd>
  );
}
