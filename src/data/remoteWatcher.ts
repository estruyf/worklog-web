// Polls GitHub for commits pushed elsewhere (another device, an edit on
// github.com). Nothing notifies us, so this is the only way an open tab that
// isn't being edited ever learns the branch moved — the only other head check
// lives in the store's `sync()`.
//
// Two triggers: a timer while the tab is visible, and the moment the tab regains
// focus, which is the case that actually matters — you come back to this tab
// after pushing from the other device.

/** How often an open tab asks GitHub whether the branch moved. One ref lookup
 *  per tick — 60/hour against a 5000/hour rate limit — and only while the tab is
 *  visible, so a backgrounded tab costs nothing. */
const CHECK_INTERVAL_MS = 60_000;

/** Floor between two checks, so a burst of focus/visibility events (alt-tabbing,
 *  switching desktops) collapses into one request. */
const MIN_GAP_MS = 10_000;

export class RemoteWatcher {
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** True once the focus/visibility listeners are registered (added once). */
  private listening = false;
  private running = false;
  /** Epoch millis of the last head check, for the min-gap throttle. */
  private lastCheck = 0;

  /**
   * @param check   Ask where the head is and act on it. Must not throw — a
   *                background check has no failure to report.
   * @param enabled Whether a check is worth making at all right now; the store
   *                says no while it is loading, committing, or holding local
   *                changes a check has no business touching.
   */
  constructor(
    private readonly check: () => Promise<void>,
    private readonly enabled: () => boolean,
  ) {}

  /** Begin (or restart) watching. Safe to call on every repo open — the timer is
   *  replaced and the listeners are only ever added once. */
  start(): void {
    this.schedule();
    if (this.listening || typeof document === 'undefined') {
      return;
    }
    this.listening = true;
    document.addEventListener('visibilitychange', this.onTabActive);
    window.addEventListener('focus', this.onTabActive);
  }

  /** Count a head check made elsewhere (the store's `sync()`) against the
   *  min-gap, so one doesn't immediately follow the other. */
  markChecked(): void {
    this.lastCheck = Date.now();
  }

  private onTabActive = (): void => {
    void this.tick();
  };

  private schedule(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      void this.tick().then(() => this.schedule());
    }, CHECK_INTERVAL_MS);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (this.running || !this.enabled()) {
      return;
    }
    // A hidden tab has nothing to show; the visibility listener catches up.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    const now = Date.now();
    if (now - this.lastCheck < MIN_GAP_MS) {
      return;
    }
    this.lastCheck = now;
    this.running = true;
    try {
      await this.check();
    } finally {
      this.running = false;
    }
  }
}
