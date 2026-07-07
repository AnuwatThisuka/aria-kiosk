import { expect, test } from "bun:test";
import { MouthEnvelope } from "./envelope";

const loud = () => new Float32Array([0.8, -0.8, 0.8, -0.8]);

test("pushing loud audio opens the mouth over a few frames", () => {
  const env = new MouthEnvelope();
  expect(env.state.openness).toBe(0);
  for (let i = 0; i < 5; i++) {
    env.push(loud());
    env.tick();
  }
  expect(env.state.openness).toBeGreaterThan(0.3);
  expect(env.state.viseme).not.toBe("sil");
});

test("silence decays the mouth back toward closed", () => {
  const env = new MouthEnvelope();
  for (let i = 0; i < 5; i++) {
    env.push(loud());
    env.tick();
  }
  const opened = env.state.openness;
  for (let i = 0; i < 40; i++) env.tick(); // no push -> target 0
  expect(env.state.openness).toBeLessThan(opened);
  expect(env.state.openness).toBeLessThan(0.05);
});

test("reset snaps shut immediately", () => {
  const env = new MouthEnvelope();
  env.push(loud());
  env.tick();
  env.reset();
  expect(env.state.openness).toBe(0);
  expect(env.state.viseme).toBe("sil");
});
