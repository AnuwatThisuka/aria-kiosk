import type { MouthState } from "./envelope";
import type { AvatarRenderer } from "./renderer";

/**
 * Minimal procedural avatar drawn on a 2D canvas — a dependency-free stand-in
 * for a full Live2D model. Renders a head, blinking eyes, an idle sway, and a
 * mouth whose height/width follow the lip-sync signal. Good enough to validate
 * the end-to-end audio → mouth pipeline before art assets land.
 */
export class CanvasAvatar implements AvatarRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mouth: MouthState = { openness: 0, viseme: "sil" };
  private eyeOpen = 1;
  private sway = 0;

  mount(container: HTMLElement): void {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 500;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxWidth = "400px";
    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  setMouth(state: MouthState): void {
    this.mouth = state;
  }

  setEyeOpen(factor: number): void {
    this.eyeOpen = factor;
  }

  setSway(x: number): void {
    this.sway = x;
  }

  render(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2 + this.sway * 10;
    const cy = h / 2;

    // Head.
    ctx.fillStyle = "#f2d3b3";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 130, 160, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — vertical scale follows blink factor.
    const eyeY = cy - 40;
    const eyeH = 22 * this.eyeOpen + 1;
    ctx.fillStyle = "#2a2a2a";
    for (const dx of [-55, 55]) {
      ctx.beginPath();
      ctx.ellipse(cx + dx, eyeY, 16, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth — height follows openness, width follows the viseme.
    const openness = this.mouth.openness;
    const mouthY = cy + 70;
    const widthByViseme: Record<MouthState["viseme"], number> = {
      sil: 46,
      ee: 64,
      aa: 54,
      oh: 40,
    };
    const mw = widthByViseme[this.mouth.viseme];
    const mh = 4 + openness * 46;
    ctx.fillStyle = "#7a2f34";
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mw / 2, mh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  destroy(): void {
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
  }
}
