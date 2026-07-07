/**
 * Keeps the kiosk display awake via the Screen Wake Lock API, re-acquiring the
 * lock when the tab becomes visible again (the browser drops it on hide). No-op
 * where the API is unavailable.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;

  private onVisibility = (): void => {
    if (document.visibilityState === "visible") void this.acquire();
  };

  private async acquire(): Promise<void> {
    if (!("wakeLock" in navigator)) return;
    try {
      this.sentinel = await navigator.wakeLock.request("screen");
    } catch {
      // Denied or not allowed (e.g. not focused) — retry on next visibility.
    }
  }

  start(): void {
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.acquire();
  }

  stop(): void {
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.sentinel?.release();
    this.sentinel = null;
  }
}
