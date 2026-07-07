import { expect, test } from "bun:test";
import { computeRms, opennessToViseme, rmsToOpenness } from "./visemes";

test("computeRms: silence is 0, full-scale is 1", () => {
  expect(computeRms(new Float32Array(64))).toBe(0);
  expect(computeRms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1, 5);
});

test("rmsToOpenness: below noise floor is silent, louder is more open", () => {
  expect(rmsToOpenness(0.01)).toBe(0);
  expect(rmsToOpenness(0.3)).toBeGreaterThan(rmsToOpenness(0.1));
  expect(rmsToOpenness(1)).toBeLessThanOrEqual(1);
});

test("opennessToViseme buckets openness into shapes", () => {
  expect(opennessToViseme(0)).toBe("sil");
  expect(opennessToViseme(0.2)).toBe("ee");
  expect(opennessToViseme(0.5)).toBe("aa");
  expect(opennessToViseme(0.9)).toBe("oh");
});
