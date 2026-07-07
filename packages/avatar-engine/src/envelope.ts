import {
  computeRms,
  opennessToViseme,
  rmsToOpenness,
  type Viseme,
} from "./visemes";

export interface MouthState {
  /** Mouth openness in [0, 1]. */
  openness: number;
  viseme: Viseme;
}

export interface MouthEnvelopeOptions {
  /** Smoothing toward a louder target (fast, so the mouth opens crisply). */
  attack?: number;
  /** Smoothing toward silence (slower, so the mouth closes naturally). */
  release?: number;
}

/**
 * Smooths incoming audio into a mouth-openness signal for lip-sync.
 *
 * Audio chunks are `push()`ed as they arrive; `tick()` is called once per
 * render frame to advance the smoothed value toward the loudest chunk seen
 * since the last frame, then clears the target so that an absence of audio
 * decays the mouth closed. Framework-agnostic and side-effect free — the
 * caller owns the render loop.
 */
export class MouthEnvelope {
  private value = 0;
  private target = 0;
  private readonly attack: number;
  private readonly release: number;

  constructor(opts: MouthEnvelopeOptions = {}) {
    this.attack = opts.attack ?? 0.6;
    this.release = opts.release ?? 0.18;
  }

  /** Feed a decoded PCM sample block (e.g. a chunk of the model's audio). */
  push(samples: Float32Array): void {
    const openness = rmsToOpenness(computeRms(samples));
    if (openness > this.target) this.target = openness;
  }

  /** Advance one frame and return the current mouth state. */
  tick(): MouthState {
    const coeff = this.target > this.value ? this.attack : this.release;
    this.value += (this.target - this.value) * coeff;
    this.target = 0;
    return this.state;
  }

  get state(): MouthState {
    return { openness: this.value, viseme: opennessToViseme(this.value) };
  }

  /** Snap shut immediately (e.g. on barge-in / interrupt). */
  reset(): void {
    this.value = 0;
    this.target = 0;
  }
}
