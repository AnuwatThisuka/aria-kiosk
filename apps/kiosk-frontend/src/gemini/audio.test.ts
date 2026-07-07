import { expect, test } from "bun:test";
import {
  base64ToBytes,
  bytesToBase64,
  decodeAudioChunk,
  encodeMicChunk,
  floatToPcm16,
  pcm16ToFloat,
} from "./audio";

test("floatToPcm16 clamps and scales", () => {
  const pcm = floatToPcm16(new Float32Array([0, 1, -1, 2, -2]));
  expect(pcm[0]).toBe(0);
  expect(pcm[1]).toBe(0x7fff);
  expect(pcm[2]).toBe(-0x8000);
  // Out-of-range values clamp to the rails.
  expect(pcm[3]).toBe(0x7fff);
  expect(pcm[4]).toBe(-0x8000);
});

test("base64 byte roundtrip is lossless", () => {
  const bytes = new Uint8Array([0, 1, 2, 254, 255, 128]);
  expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
});

test("mic encode -> decode roundtrip preserves samples within quantization", () => {
  const input = new Float32Array([0, 0.5, -0.5, 0.25, -0.99]);
  const decoded = decodeAudioChunk(encodeMicChunk(input));
  expect(decoded.length).toBe(input.length);
  for (let i = 0; i < input.length; i++) {
    expect(Math.abs(decoded[i]! - input[i]!)).toBeLessThan(1e-3);
  }
});

test("pcm16ToFloat inverts floatToPcm16 for exact rails", () => {
  const f = pcm16ToFloat(new Int16Array([0, -0x8000]));
  expect(f[0]).toBe(0);
  expect(f[1]).toBe(-1);
});
