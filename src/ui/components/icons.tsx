import React from 'react';

/** The navigation rail's glyphs.
 *
 *  Everywhere else the app draws from `lucide-react`; these seven are the
 *  exception, hand-tuned to read at 16px against the rail's weight. They live
 *  here rather than inline in `Sidebar` so that file is about navigating rather
 *  than about paths — it carried 76 lines of them.
 *
 *  Anything that is *not* one of these belongs in lucide. A second hand-rolled
 *  icon set is what this file used to be, and nothing used it. */
function NavGlyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function NavDayIcon() {
  return (
    <NavGlyph>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M4.5 6h7M4.5 8.5h7M4.5 11h4" />
    </NavGlyph>
  );
}

export function NavOverdueIcon() {
  return (
    <NavGlyph>
      <path d="M8 2.2l6.2 10.6a.8.8 0 01-.7 1.2H2.5a.8.8 0 01-.7-1.2L8 2.2z" strokeLinejoin="round" />
      <path d="M8 6.2v3.1" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.5" fill="currentColor" stroke="none" />
    </NavGlyph>
  );
}

export function NavTodosIcon() {
  return (
    <NavGlyph>
      <path d="M1.5 3.5L3 5l2.5-2.5M1.5 8L3 9.5 5.5 7M1.5 12.5L3 14l2.5-2.5" />
      <path d="M8 4h6.5M8 8.5h6.5M8 13h6.5" />
    </NavGlyph>
  );
}

export function NavCalendarIcon() {
  return (
    <NavGlyph>
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6h12M5 1.5v2M11 1.5v2" />
      <rect x="4.5" y="8" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
      <rect x="9.5" y="8" width="2" height="2" rx="0.3" fill="currentColor" stroke="none" />
    </NavGlyph>
  );
}

export function NavClientsIcon() {
  return (
    <NavGlyph>
      <rect x="1.5" y="4.5" width="13" height="9" rx="1.5" />
      <path d="M5.5 4.5V3.5a1 1 0 011-1h3a1 1 0 011 1v1" />
    </NavGlyph>
  );
}

export function NavInsightsIcon() {
  return (
    <NavGlyph>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" />
    </NavGlyph>
  );
}

export function NavArchiveIcon() {
  return (
    <NavGlyph>
      <path d="M2 5.5h12" />
      <rect x="2" y="3" width="12" height="3" rx="1" />
      <path d="M3.5 6v6.5a1 1 0 001 1h7a1 1 0 001-1V6" />
    </NavGlyph>
  );
}

/** The triangle that says a block folds open. Written three different ways before
 *  — an SVG path here, a `›` character there — which is why it is one thing now. */
export function DisclosureIcon({ open, size = 12 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={'shrink-0 transition-transform ' + (open ? 'rotate-90' : '')}
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
