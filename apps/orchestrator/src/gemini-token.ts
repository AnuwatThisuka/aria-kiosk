import { GoogleGenAI } from "@google/genai";

/**
 * Gemini Live model the kiosk connects to with the ephemeral token. Must be a
 * `bidiGenerateContent`-capable Live model that is actually enabled on this API
 * key — an unavailable model is rejected with a 1008 close ("not found for
 * bidiGenerateContent"). Verified working on this key via a live handshake.
 * Keep in sync with the frontend's `GEMINI_LIVE_MODEL`.
 *
 * Availability shifts over time; on a 1008, list Live models for your key and
 * pick a current one (e.g. a newer `gemini-2.5-flash-native-audio-*`).
 */
export const GEMINI_LIVE_MODEL =
  "gemini-2.5-flash-native-audio-preview-12-2025";

/** How long a minted ephemeral token stays valid before the client must re-mint. */
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
/** Window after mint during which the token may open a new session. */
const NEW_SESSION_WINDOW_MS = 1 * 60 * 1000; // 1 minute

export interface EphemeralToken {
  /** Opaque token string the frontend passes to the Gemini Live WebSocket. */
  token: string;
  /** ISO timestamp after which the token can no longer be used. */
  expiresAt: string;
}

/**
 * Mint a short-lived Gemini Live ephemeral token, server-side, from the
 * long-lived `GEMINI_API_KEY`. The frontend never sees the real key — it
 * receives only this scoped, expiring token. Locking `uses` and the session
 * window keeps a leaked token low-value.
 */
export async function mintEphemeralToken(
  apiKey?: string,
): Promise<EphemeralToken> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set — cannot mint ephemeral token");
  }

  // Ephemeral tokens are a v1alpha feature — mint on that API surface.
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: { apiVersion: "v1alpha" },
  });
  const now = Date.now();
  const expireTime = new Date(now + TOKEN_TTL_MS).toISOString();
  const newSessionExpireTime = new Date(
    now + NEW_SESSION_WINDOW_MS,
  ).toISOString();

  const authToken = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: GEMINI_LIVE_MODEL,
      },
    },
  });

  if (!authToken.name) {
    throw new Error("Gemini did not return an ephemeral token name");
  }

  return { token: authToken.name, expiresAt: expireTime };
}
