/**
 * Avatar engine — audio-driven lip-sync + idle animation.
 *
 * Pipeline: decoded model audio → {@link MouthEnvelope} (RMS → smoothed
 * openness) → {@link AvatarController} (adds blink + breathing) →
 * {@link AvatarRenderer} ({@link CanvasAvatar} now, {@link Live2DRenderer}
 * once the Cubism SDK is wired).
 */
export * from "./visemes";
export * from "./envelope";
export * from "./idle";
export * from "./renderer";
export * from "./controller";
export * from "./canvasAvatar";
export * from "./live2d";
