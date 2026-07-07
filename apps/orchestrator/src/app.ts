import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { mintEphemeralToken } from "./gemini-token";
import { createGrounder, type Grounder } from "./grounding";
import { createMediaFinder, type MediaFinder } from "./media";

export interface AppDeps {
  /** Override the Supermemory-backed grounder (used in tests). */
  ground?: Grounder;
  /** Override the media finder (used in tests). */
  findMedia?: MediaFinder;
}

/** Read a non-empty `query` string from a JSON body, or null. */
async function readQuery(c: Context): Promise<string | null> {
  try {
    const body = (await c.req.json()) as { query?: unknown };
    if (typeof body.query === "string" && body.query.trim()) return body.query;
  } catch {
    // No/invalid JSON body.
  }
  return null;
}

/**
 * Build the orchestrator Hono app. Kept separate from the server bootstrap so
 * tests can exercise routes via `app.request()` without opening a port or
 * touching live services.
 */
export function createApp(deps: AppDeps = {}) {
  const app = new Hono();
  const ground = deps.ground ?? createGrounder();
  const findMedia = deps.findMedia ?? createMediaFinder();

  app.use("*", cors());

  app.get("/health", (c) => c.json({ status: "ok" }));

  /**
   * Issue a short-lived Gemini Live ephemeral token to the frontend. Fails
   * gracefully with a 503 so the kiosk can fall back rather than crash.
   */
  app.post("/api/gemini-token", async (c) => {
    try {
      const token = await mintEphemeralToken();
      return c.json(token);
    } catch (err) {
      console.error("failed to mint ephemeral token:", err);
      return c.json({ error: "token_unavailable" }, 503);
    }
  });

  /**
   * Ground a transcript/typed query against `kiosk_knowledge` and return a
   * context block the frontend injects into the Gemini Live session. Always
   * 200 — on retrieval failure it returns empty grounding + `degraded: true`
   * so the conversation continues ungrounded rather than breaking.
   */
  app.post("/api/ground", async (c) => {
    const query = await readQuery(c);
    if (!query) return c.json({ error: "query_required" }, 400);
    return c.json(await ground(query));
  });

  /**
   * Resolve contextual media for a spoken/typed query: `kiosk_media` library
   * first, then web fallback. Always 200 — returns `{ source: "none" }` when
   * nothing matches so the frontend simply shows no panel.
   */
  app.post("/api/media", async (c) => {
    const query = await readQuery(c);
    if (!query) return c.json({ error: "query_required" }, 400);
    return c.json(await findMedia(query));
  });

  return app;
}
