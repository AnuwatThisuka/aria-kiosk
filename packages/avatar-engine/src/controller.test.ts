import { expect, test } from "bun:test";
import { AvatarController } from "./controller";
import { MouthEnvelope } from "./envelope";
import type { MouthState } from "./envelope";
import type { AvatarRenderer } from "./renderer";

class FakeRenderer implements AvatarRenderer {
  mouth: MouthState = { openness: 0, viseme: "sil" };
  eyeOpen = 1;
  sway = 0;
  renders = 0;
  mount(): void {}
  setMouth(s: MouthState): void {
    this.mouth = s;
  }
  setEyeOpen(f: number): void {
    this.eyeOpen = f;
  }
  setSway(x: number): void {
    this.sway = x;
  }
  render(): void {
    this.renders++;
  }
  destroy(): void {}
}

test("frame() drives the renderer from the envelope each step", () => {
  const renderer = new FakeRenderer();
  const envelope = new MouthEnvelope();
  let t = 0;
  const ctrl = new AvatarController(renderer, envelope, {
    now: () => t,
    blink: { random: () => 0.5 },
  });

  // Silence: mouth stays shut, renderer still paints (idle/attract loop).
  ctrl.frame();
  expect(renderer.renders).toBe(1);
  expect(renderer.mouth.openness).toBe(0);

  // Speaking: push loud audio and step a few frames -> mouth opens.
  for (let i = 0; i < 5; i++) {
    envelope.push(new Float32Array([0.8, -0.8, 0.8, -0.8]));
    t += 16;
    ctrl.frame();
  }
  expect(renderer.mouth.openness).toBeGreaterThan(0.3);
  expect(renderer.renders).toBe(6);
});
