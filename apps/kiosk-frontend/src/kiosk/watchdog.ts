/**
 * Unattended-operation watchdog: on an uncaught error or unhandled rejection,
 * reload the page after a short delay so the kiosk self-heals instead of
 * sitting on a broken screen. Returns a disposer.
 */
export interface WatchdogOptions {
  /** Delay before reloading after a fault (ms). */
  reloadDelayMs?: number;
  /** Reload action; injectable for tests. */
  reload?: () => void;
}

export function installWatchdog(opts: WatchdogOptions = {}): () => void {
  const delay = opts.reloadDelayMs ?? 3000;
  const reload = opts.reload ?? (() => window.location.reload());
  let scheduled = false;

  const onFault = (): void => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(reload, delay);
  };

  window.addEventListener("error", onFault);
  window.addEventListener("unhandledrejection", onFault);

  return () => {
    window.removeEventListener("error", onFault);
    window.removeEventListener("unhandledrejection", onFault);
  };
}
