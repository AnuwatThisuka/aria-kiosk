/**
 * Idle / attract-mode animation helpers: gentle breathing sway and periodic
 * blinking. Pure and deterministic (injectable RNG) so they can be unit
 * tested and reproduced.
 */

/** Breathing sway in [-1, 1] for a given time. */
export function breathing(tMs: number, periodMs = 4000): number {
  return Math.sin((tMs / periodMs) * 2 * Math.PI);
}

export interface BlinkOptions {
  minIntervalMs?: number;
  maxIntervalMs?: number;
  durationMs?: number;
  /** RNG returning [0, 1); injectable for tests. */
  random?: () => number;
}

/**
 * Schedules random blinks and reports an eye-open factor in [0, 1] (1 = fully
 * open, 0 = fully shut mid-blink). Call {@link update} each frame with a
 * monotonic timestamp.
 */
export class BlinkScheduler {
  private readonly minInterval: number;
  private readonly maxInterval: number;
  private readonly duration: number;
  private readonly random: () => number;
  private nextBlinkAt: number | null = null;
  private blinkStart = -Infinity;

  constructor(opts: BlinkOptions = {}) {
    this.minInterval = opts.minIntervalMs ?? 2500;
    this.maxInterval = opts.maxIntervalMs ?? 6000;
    this.duration = opts.durationMs ?? 140;
    this.random = opts.random ?? Math.random;
  }

  private scheduleNext(tMs: number): void {
    const span = this.maxInterval - this.minInterval;
    this.nextBlinkAt = tMs + this.minInterval + this.random() * span;
  }

  /** Advance and return the eye-open factor in [0, 1]. */
  update(tMs: number): number {
    if (this.nextBlinkAt === null) this.scheduleNext(tMs);
    if (this.nextBlinkAt !== null && tMs >= this.nextBlinkAt) {
      this.blinkStart = tMs;
      this.scheduleNext(tMs);
    }
    const elapsed = tMs - this.blinkStart;
    if (elapsed < 0 || elapsed > this.duration) return 1;
    // Triangular dip: 1 -> 0 -> 1 across the blink duration.
    const half = this.duration / 2;
    const factor =
      elapsed < half ? 1 - elapsed / half : (elapsed - half) / half;
    return Math.max(0, Math.min(1, factor));
  }
}
