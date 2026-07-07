/**
 * Amplitude-driven viseme approximation.
 *
 * Gemini Live returns raw PCM audio with no phoneme/timing data, so — like
 * Live2D's built-in lip-sync — we drive the mouth from the audio's RMS
 * envelope. Loudness maps to mouth openness, and openness is bucketed into a
 * small viseme set for mouth-shape variety. This is an approximation, not true
 * phoneme lip-sync (which would need a separate forced-aligner).
 */

/** Coarse mouth shapes, ordered roughly by openness. */
export type Viseme = "sil" | "ee" | "aa" | "oh";

/** Root-mean-square amplitude of a PCM sample block, in [0, 1]. */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Map RMS amplitude to mouth openness in [0, 1]. Uses a sqrt curve (perceptual
 * loudness) with a small noise floor so quiet background doesn't twitch the
 * mouth.
 */
export function rmsToOpenness(rms: number): number {
  const NOISE_FLOOR = 0.02;
  const GAIN = 3.2;
  if (rms <= NOISE_FLOOR) return 0;
  return Math.min(1, Math.sqrt(rms) * GAIN - NOISE_FLOOR);
}

/** Bucket mouth openness into a viseme shape. */
export function opennessToViseme(openness: number): Viseme {
  if (openness < 0.08) return "sil";
  if (openness < 0.35) return "ee";
  if (openness < 0.65) return "aa";
  return "oh";
}
