/**
 * Kiosk UX state machine (single source of truth per AGENTS.md — do not
 * scatter idle/timeout logic across components).
 *
 *   idle ──wake──▶ connecting ──connected──▶ active
 *     ▲                │                        │
 *     │              error                   timeout / end
 *     │                ▼                        ▼
 *     └──reset── goodbye ◀──────────────────── goodbye
 *
 * `active` also drops to `reconnecting` on a transport disconnect and returns
 * to `active` once the session re-establishes. Timers (inactivity, goodbye
 * hold) live in the controller hook; this reducer is pure and deterministic.
 */
export type KioskState =
  "idle" | "connecting" | "active" | "reconnecting" | "goodbye";

export type KioskEvent =
  | { type: "wake" }
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "timeout" }
  | { type: "end" }
  | { type: "error" }
  | { type: "reset" };

/** Inactivity before a conversation auto-ends (ms). */
export const INACTIVITY_TIMEOUT_MS = 45_000;

/** How long the goodbye screen shows before returning to attract mode (ms). */
export const GOODBYE_HOLD_MS = 4_000;

export function kioskTransition(
  state: KioskState,
  event: KioskEvent,
): KioskState {
  switch (state) {
    case "idle":
      return event.type === "wake" ? "connecting" : "idle";

    case "connecting":
      switch (event.type) {
        case "connected":
          return "active";
        case "disconnected":
          return "reconnecting";
        case "error":
        case "end":
          return "idle";
        default:
          return "connecting";
      }

    case "active":
      switch (event.type) {
        case "timeout":
        case "end":
        case "error":
          return "goodbye";
        case "disconnected":
          return "reconnecting";
        default:
          return "active";
      }

    case "reconnecting":
      switch (event.type) {
        case "connected":
          return "active";
        case "timeout":
          return "goodbye";
        case "error":
        case "end":
          return "idle";
        default:
          return "reconnecting";
      }

    case "goodbye":
      return event.type === "reset" ? "idle" : "goodbye";
  }
}

/** Whether an idle timeout has elapsed since the last activity. */
export function isIdleTimedOut(
  lastActivityMs: number,
  nowMs: number,
  timeoutMs = INACTIVITY_TIMEOUT_MS,
): boolean {
  return nowMs - lastActivityMs >= timeoutMs;
}
