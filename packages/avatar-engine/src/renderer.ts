import type { MouthState } from "./envelope";

/**
 * A pluggable avatar renderer. The {@link AvatarController} drives any
 * implementation with the same per-frame signals, so the procedural
 * {@link CanvasAvatar} and a future Live2D renderer are interchangeable.
 */
export interface AvatarRenderer {
  /** Attach to a container element. */
  mount(container: HTMLElement): void;
  /** Current mouth shape/openness (lip-sync). */
  setMouth(state: MouthState): void;
  /** Eye-open factor in [0, 1] (blink). */
  setEyeOpen(factor: number): void;
  /** Horizontal idle sway in [-1, 1] (breathing). */
  setSway(x: number): void;
  /** Paint the current frame. */
  render(): void;
  /** Detach and release resources. */
  destroy(): void;
}
