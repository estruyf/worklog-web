// Shared display constants for the UI.

/** ⌘ on Apple keyboards, Ctrl everywhere else. Every handler binds both, so a
 *  label only ever names the key the reader actually has. Read once at module
 *  load: the UI hydrates `client:only`, so there is no server render to disagree
 *  with. One copy, because two of them drift and the stale one is a lie about a
 *  keystroke — see `views/ShortcutsView`, which is the other reader. */
export const MOD_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';

/** Fallback client colors, indexed by client position when none is configured. */
export const PALETTE = ['#2D6CDF', '#27C281', '#A05BD6', '#E0683B', '#0FA8A8', '#D63B6E', '#5B7BD6'];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Fallback status colors by id, used when a StatusDef supplies none. Covers a
 *  few ids the defaults don't ship, so a status someone names "Waiting" or
 *  "Blocked" reads right before they pick a colour for it. */
export const STATUS_COLORS: Record<string, string> = {
  open: '#6E7781',
  'in-progress': '#2D6CDF',
  waiting: '#C8860D',
  blocked: '#DC2626',
  done: '#16A34A',
  closed: '#16A34A',
};

/** The colours the status editor offers. Ordered grey → green, the arc a task
 *  actually travels, rather than by hue: the list is picked from top to bottom
 *  while adding statuses in the order they happen. */
export const STATUS_PALETTE = ['#6E7781', '#2D6CDF', '#7C4DDB', '#0FA8A8', '#C8860D', '#DC2626', '#16A34A'];
