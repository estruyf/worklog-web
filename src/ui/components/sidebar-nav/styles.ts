// The rail's two row shapes. Both are one-offs rather than `Button` variants:
// a nav row is full-width, left-aligned and carries its own active state, which
// is a different control from the app's buttons even where the colours rhyme.

/** A nav tab. `active` is the current view, not hover. */
export const navItemClass = (active: boolean) =>
  'flex items-center gap-[10px] w-full px-[12px] py-[9px] rounded-control-md text-control-lg cursor-pointer text-left transition-colors ' +
  (active
    ? 'font-semibold bg-brand-225 border border-brand-425 text-brand-800'
    : 'font-medium bg-transparent border border-transparent text-neutral-750 hover:bg-neutral-200');

/** Full-width sidebar action button (Search / Git sync / Shortcuts / Settings).
 *  The caller appends the border and text colours, which vary per state. */
export const actionClass =
  'relative flex items-center gap-[10px] w-full px-[12px] py-[8px] rounded-control-md text-control font-medium cursor-pointer transition-colors border';
