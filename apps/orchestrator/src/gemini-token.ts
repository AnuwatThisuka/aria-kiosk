import { GoogleGenAI } from "@google/genai";

/** Gemini Live model the kiosk frontend connects to with the ephemeral token. */
export const GEMINI_LIVE_MODEL = "gemini-2.0-flash-live-001";

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

  const ai = new GoogleGenAI({ apiKey: key });
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
