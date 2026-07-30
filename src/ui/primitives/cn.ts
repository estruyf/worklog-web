/** Joins class names, dropping anything falsy — the usual `cond && 'class'` idiom.
 *
 *  Deliberately not a Tailwind-aware merge: the project has no `tailwind-merge`,
 *  and class order in the attribute does not decide which utility wins (the CSS
 *  source order does). So a `className` passed to a primitive can *add* utilities
 *  — layout, margins, width — but cannot reliably *override* the ones its variant
 *  and size already set. Anything that needs different padding or a different
 *  colour wants a new variant here, not an override at the call site. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
