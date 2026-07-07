import type { MouthState } from "./envelope";
import type { AvatarRenderer } from "./renderer";

/**
 * Live2D (Cubism) renderer — integration scaffold.
 *
 * Wiring a real Live2D avatar requires the proprietary Cubism Core SDK plus a
 * `.model3.json` model, neither of which can be bundled here. The parameter
 * mapping is fixed, though, so dropping in the SDK is mechanical:
 *
 *   - `MouthState.openness` → `ParamMouthOpenY`
 *   - `MouthState.viseme`   → `ParamMouthForm`   (ee=+1, oh=-1, aa=0, sil=0)
 *   - `eyeOpen`             → `ParamEyeLOpen` / `ParamEyeROpen`
 *   - `sway`               → `ParamAngleX` / `ParamBodyAngleX`
 *
 * Load the Cubism model in {@link mount}, set params in the setters, and call
 * the Cubism update+draw in {@link render}. Until then it stays inert so the
 * app can select the {@link CanvasAvatar} fallback without a hard dependency.
 */
export class Live2DRenderer implements AvatarRenderer {
  /** Maps a viseme to Cubism's `ParamMouthForm` value. */
  static mouthForm(viseme: MouthState["viseme"]): number {
    switch (viseme) {
      case "ee":
        return 1;
      case "oh":
        return -1;
      default:
        return 0;
    }
  }

  mount(): void {
    throw new Error(
      "Live2DRenderer requires the Cubism Core SDK + a model — not configured. " +
        "Use CanvasAvatar, or complete the integration in live2d.ts.",
    );
  }
  setMouth(_state: MouthState): void {}
  setEyeOpen(_factor: number): void {}
  setSway(_x: number): void {}
  render(): void {}
  destroy(): void {}
}
