import { expect, test } from "bun:test";
import {
  INACTIVITY_TIMEOUT_MS,
  isIdleTimedOut,
  kioskTransition,
  type KioskState,
} from "./kioskMachine";

test("wake starts a connection, connected goes active", () => {
  expect(kioskTransition("idle", { type: "wake" })).toBe("connecting");
  expect(kioskTransition("connecting", { type: "connected" })).toBe("active");
});

test("idle ignores non-wake events", () => {
  for (const t of ["connected", "timeout", "end", "error"] as const) {
    expect(kioskTransition("idle", { type: t })).toBe("idle");
  }
});

test("inactivity timeout ends the conversation and resets to idle", () => {
  let s: KioskState = "active";
  s = kioskTransition(s, { type: "timeout" });
  expect(s).toBe("goodbye");
  s = kioskTransition(s, { type: "reset" });
  expect(s).toBe("idle");
});

test("end and error from active both go to goodbye", () => {
  expect(kioskTransition("active", { type: "end" })).toBe("goodbye");
  expect(kioskTransition("active", { type: "error" })).toBe("goodbye");
});

test("transport disconnect drops to reconnecting, reconnect returns to active", () => {
  expect(kioskTransition("active", { type: "disconnected" })).toBe(
    "reconnecting",
  );
  expect(kioskTransition("reconnecting", { type: "connected" })).toBe("active");
});

test("giving up reconnect returns to attract mode", () => {
  expect(kioskTransition("reconnecting", { type: "error" })).toBe("idle");
});

test("goodbye only leaves on reset", () => {
  expect(kioskTransition("goodbye", { type: "wake" })).toBe("goodbye");
  expect(kioskTransition("goodbye", { type: "reset" })).toBe("idle");
});

test("isIdleTimedOut compares against the timeout window", () => {
  expect(isIdleTimedOut(0, INACTIVITY_TIMEOUT_MS - 1)).toBe(false);
  expect(isIdleTimedOut(0, INACTIVITY_TIMEOUT_MS)).toBe(true);
  expect(isIdleTimedOut(1000, 1000 + INACTIVITY_TIMEOUT_MS, 5000)).toBe(true);
});
