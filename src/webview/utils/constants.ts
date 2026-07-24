// Shared display constants for the webview.

/** Fallback client colors, indexed by client position when none is configured. */
export const PALETTE = ['#2D6CDF', '#27C281', '#A05BD6', '#E0683B', '#0FA8A8', '#D63B6E', '#5B7BD6'];

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Fallback status colors by id, used when a StatusDef supplies none. */
export const STATUS_COLORS: Record<string, string> = {
  open: '#6E7781',
  'in-progress': '#2D6CDF',
  waiting: '#C8860D',
  blocked: '#DC2626',
  done: '#16A34A',
  closed: '#16A34A',
};
