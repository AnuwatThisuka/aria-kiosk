import type { MouthEnvelope } from "./envelope";
import { BlinkScheduler, breathing, type BlinkOptions } from "./idle";
import type { AvatarRenderer } from "./renderer";

export interface AvatarControllerOptions {
  blink?: BlinkOptions;
  /** Idle sway period in ms. */
  breathingPeriodMs?: number;
  /** Frame source; defaults to requestAnimationFrame. Injectable for tests. */
  now?: () => number;
}

/**
 * Drives an {@link AvatarRenderer} every animation frame from a
 * {@link MouthEnvelope} (lip-sync) plus idle blink/breathing. Runs continuously
 * — when no audio is arriving the envelope decays shut and only the idle
 * animation plays, which doubles as attract mode.
 */
export class AvatarController {
  private readonly blink: BlinkScheduler;
  private readonly breathingPeriod: number;
  private readonly now: () => number;
  private rafId: number | null = null;
  private running = false;

  constructor(
    private readonly renderer: AvatarRenderer,
    private readonly envelope: MouthEnvelope,
    opts: AvatarControllerOptions = {},
  ) {
    this.blink = new BlinkScheduler(opts.blink);
    this.breathingPeriod = opts.breathingPeriodMs ?? 4000;
    this.now = opts.now ?? (() => performance.now());
  }

  /** Advance and paint a single frame (exposed for tests/manual stepping). */
  frame(): void {
    const t = this.now();
    this.renderer.setMouth(this.envelope.tick());
    this.renderer.setEyeOpen(this.blink.update(t));
    this.renderer.setSway(breathing(t, this.breathingPeriod));
    this.renderer.render();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
