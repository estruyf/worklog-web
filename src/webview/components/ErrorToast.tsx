import React from 'react';

/** Transient error banner pinned to the bottom of the shell. */
export function ErrorToast({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-[8px] bg-[#FEF2F2] border border-[#F0C9C9] text-[#DC2626] text-[13px] px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      {message}
    </div>
  );
}
