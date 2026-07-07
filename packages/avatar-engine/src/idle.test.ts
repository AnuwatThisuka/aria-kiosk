import { expect, test } from "bun:test";
import { BlinkScheduler, breathing } from "./idle";

test("breathing oscillates within [-1, 1]", () => {
  expect(breathing(0)).toBeCloseTo(0, 5);
  expect(breathing(1000, 4000)).toBeCloseTo(1, 5); // quarter period -> peak
  for (let t = 0; t < 8000; t += 250) {
    const v = breathing(t);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  }
});

test("BlinkScheduler stays open, then dips to 0 during a scheduled blink", () => {
  // Deterministic RNG -> blink scheduled at min interval (2500ms).
  const blink = new BlinkScheduler({
    minIntervalMs: 2500,
    maxIntervalMs: 6000,
    durationMs: 140,
    random: () => 0,
  });
  expect(blink.update(0)).toBe(1);
  expect(blink.update(1000)).toBe(1);
  // Enter the blink window (start at 2500) and land near its midpoint.
  blink.update(2500);
  const mid = blink.update(2570); // ~half of 140ms duration
  expect(mid).toBeLessThan(0.3);
  // Fully reopened afterwards.
  expect(blink.update(3000)).toBe(1);
});
