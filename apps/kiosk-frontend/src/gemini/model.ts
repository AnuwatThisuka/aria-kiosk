/**
 * Gemini Live model the kiosk connects to. MUST match the model the
 * orchestrator locks into the ephemeral token's `liveConnectConstraints`
 * (see apps/orchestrator/src/gemini-token.ts) — the token is scoped to it.
 */
export const GEMINI_LIVE_MODEL = "gemini-2.0-flash-live-001";

/** Gemini Live input sample rate (PCM16 mono). */
export const INPUT_SAMPLE_RATE = 16000;

/** Gemini Live output sample rate (PCM16 mono). */
export const OUTPUT_SAMPLE_RATE = 24000;
